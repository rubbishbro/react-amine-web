#!/usr/bin/env python3
"""
无害化黑盒 Web 漏洞扫描器 (Non-destructive blackbox scanner)
============================================================
针对本仓库 Amine Web (FastAPI + React) 测试环境编写。

设计原则 —— 每一次探测都是"无害的"：
  1. 不改动/删除/写入任何数据；不注入能实际执行的攻击载荷。
  2. SQLi 只用单引号/布尔逻辑探针，观察服务器的"反应差异"(500 vs 200)，
     绝不使用 DROP/UPDATE/DELETE/UNION 拖库/SLEEP 慢查询。
  3. XSS 只注入可见标记 <b>XSS-PROBE-xxx</b>，检测是否被原样反射(未转义)，
     不注入任何会窃取 cookie 或执行恶意脚本的载荷。
  4. CSRF 用"明显非法 body"探测：非法数据永远无法入库，只是看拒绝发生在
     哪一层(业务校验 422 vs 权限校验 401/403)。
  5. 暴力破解默认关闭(--brute 开启)；开启时也仅限测试账号 + 限速。
  6. 访问控制只发 GET，不做越权写操作。

用法:
    python3 vuln_scanner.py --target http://localhost:8000 [--brute] [--json report.json]
依赖:
    pip install requests beautifulsoup4
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

API_PREFIX = "/api/v1"

# ---------------- 载荷与判据 ----------------
# SQLi error-based：触发解析/类型错误即可能为注入点
SQLI_ERROR_PAYLOADS = ["'", '"', "\\", "1'--", "1';--"]
SQLI_ERROR_MARKERS = [
    "sqlite", "postgres", "mysql", "mariadb", "sql server",
    "syntax error", "psycopg", "sqlalchemy", "psql", "ORA-",
    "unterminated quoted string", "invalid input syntax",
    "duplicate key", "stack trace",
]
# SQLi boolean-based：两串仅常数不同，注入时结果集差异 -> 数字型注入信号。
# 注意不能比较裸数字("1" vs "2")：关键词搜索本就对它们返回不同结果(误报源)。
SQLI_BOOL_PAIRS = [
    ("1 AND 1=1", "1 AND 1=2"),
    ("1' OR '1'='1", "1' OR '1'='2"),
    ("1 OR 1=1", "1 OR 1=2"),
]

# XSS：只注入可见标记，检测是否原样反射
XSS_TAG_TMPL = '<b id="xss-probe-{uid}">harmless-probe</b>'

# 常见错误信息泄漏关键词（页面/JSON body 中出现即标记）
LEAK_MARKERS = ["traceback", "detail", "exception", "internal server error"]

# ---------------- 目标端点配置 ----------------
# GET 端点上带字符串参数的注入候选；受保护端点用于访问控制检查
GET_ENDPOINTS: Dict[str, Dict] = {
    "search/posts": {"path": f"{API_PREFIX}/search/posts", "params": {"q": "test"}},
    "posts-list": {"path": f"{API_PREFIX}/posts/", "params": {"skip": "0", "limit": "5"}},
    "users-list": {"path": f"{API_PREFIX}/users/", "params": {}},
    "search-all": {"path": f"{API_PREFIX}/search/all", "params": {"q": "test"}},
}

# 未登录访问应被拒绝的受保护端点 (GET)
PROTECTED_ENDPOINTS = [
    f"{API_PREFIX}/users/me",
    f"{API_PREFIX}/notifications/",
    f"{API_PREFIX}/dm/threads",
    f"{API_PREFIX}/admin/users",
]

# 状态变更端点 -> 用于 CSRF 检查（只发非法 body，不会真正入库）
# public=True 的端点为公开展示型(登录/注册)，CSRF 属于信息性提示而非漏洞
POST_ENDPOINTS = {
    "login": {"path": f"{API_PREFIX}/login/access-token", "public": True},
    "register": {"path": f"{API_PREFIX}/auth/register-email", "public": True},
    "create-post": {"path": f"{API_PREFIX}/posts/", "public": False},
    "send-dm": {"path": f"{API_PREFIX}/dm/send", "public": False},
}

TIMEOUT = 10


# ---------------- 数据结构 ----------------
@dataclass
class Finding:
    status: str            # VULNERABLE / SUSPICIOUS / OK / SKIPPED
    title: str
    detail: str


@dataclass
class Scanner:
    target: str
    session: requests.Session = field(default_factory=requests.Session)
    findings: List[Finding] = field(default_factory=list)
    _probe_counter: int = 0
    _rate_limited: List[str] = field(default_factory=list)
    delay: float = 0.4   # 每次探测之间的间隔(秒)，尊重目标限速

    def _r(self, method: str, path: str, **kw) -> requests.Response:
        kw.setdefault("timeout", TIMEOUT)
        kw.setdefault("allow_redirects", True)
        kw.setdefault("headers", {"User-Agent": "amine-vuln-scanner/1.0 (harmless probes)"})
        url = self.target.rstrip("/") + path
        resp = self.session.request(method, url, **kw)
        if resp.status_code == 429:  # 目标速率限制生效 -> 记录为正信号并按 Retry-After 退避
            self._rate_limited.append(f"{method} {path}")
            wait = int(resp.headers.get("Retry-After", "5"))
            time.sleep(min(wait + 1, 12))
            resp = self.session.request(method, url, **kw)
        if self.delay:
            time.sleep(self.delay)
        return resp

    def _uid(self) -> str:
        self._probe_counter += 1
        return f"{self._probe_counter:03d}"

    def add(self, status: str, title: str, detail: str) -> None:
        print(f"[{status:>10}] {title}")
        if detail:
            print(f"            {detail}")
        self.findings.append(Finding(status, title, detail))

    # ---------------- 探测模块 ----------------
    def check_headers(self) -> None:
        for ep in ["/", API_PREFIX + "/posts"]:
            try:
                resp = self._r("GET", ep)
            except requests.RequestException as e:
                self.add("SKIPPED", f"headers @ {ep}", f"连接失败: {e}")
                continue
            h = {k.lower(): v for k, v in resp.headers.items()}
            missing = [x for x in
                       ("content-security-policy", "x-content-type-options",
                        "x-frame-options", "strict-transport-security")
                       if x not in h]
            if missing:
                self.add("SUSPICIOUS", f"缺少安全响应头 @ {ep}",
                         f"缺少: {', '.join(missing)}")
            else:
                self.add("OK", f"安全响应头齐全 @ {ep}")

    def check_sqli(self) -> None:
        for name, cfg in GET_ENDPOINTS.items():
            base_params = dict(cfg["params"])
            # 找出可注入的字符串参数
            injectables = {k: v for k, v in base_params.items() if isinstance(v, str) and v}
            if not injectables:
                self.add("SKIPPED", f"SQLi @ {name}", "无字符串参数")
                continue
            for param in injectables:
                self._sqli_on(name, cfg["path"], param, base_params)

    def _sqli_on(self, name: str, path: str, param: str, base: Dict[str, str]) -> None:
        # 1) error-based：正常值 vs 异常载荷，观察状态码与 body 差异
        normal = self._r("GET", path, params={**base, param: base[param]})
        for payload in SQLI_ERROR_PAYLOADS:
            p = {**base, param: payload}
            try:
                resp = self._r("GET", path, params=p)
            except requests.RequestException as e:
                self.add("SKIPPED", f"SQLi(error) {name}.{param}", str(e))
                return
            if resp.status_code >= 500 and normal.status_code < 500:
                leak = [m for m in SQLI_ERROR_MARKERS if m in resp.text.lower()]
                self.add(
                    "VULNERABLE",
                    f"SQLi(error) {name}?{param}",
                    f"载荷 {payload!r} 触发 {resp.status_code}，差异于正常 {normal.status_code}"
                    + (f"；响应含特征: {leak}" if leak else ""),
                )
                return
        # 2) boolean-based：1=1 vs 1=2 响应差异。
        #    判据要点(避免已知误报):
        #      - 双方都必须 2xx：若 4xx(如 int 参数被类型校验拒绝)，根本未进入 SQL
        #      - 剔除响应中对输入的回显字段再比较，避免"echo 差异"伪装成"结果集差异"
        for truthy, falsy in SQLI_BOOL_PAIRS:
            r1 = self._r("GET", path, params={**base, param: truthy})
            r2 = self._r("GET", path, params={**base, param: falsy})
            if not (r1.status_code < 400 and r2.status_code < 400):
                self.add("OK", f"SQLi {name}?{param}",
                         f"参数被类型校验拒绝({r1.status_code}/{r2.status_code})，未进入查询")
                return
            body1 = r1.text.replace(truthy, "")
            body2 = r2.text.replace(falsy, "")
            if body1 != body2:
                self.add(
                    "SUSPICIOUS",
                    f"SQLi(boolean) {name}?{param}",
                    f"'{truthy}' 与 '{falsy}' 返回不同内容，疑似可注入",
                )
                return
        self.add("OK", f"SQLi {name}?{param}", "无报错/无布尔差异")

    def check_xss(self) -> None:
        for name, cfg in GET_ENDPOINTS.items():
            for param in cfg["params"]:
                uid = self._uid()
                payload = XSS_TAG_TMPL.format(uid=uid)
                p = {**cfg["params"], param: payload}
                try:
                    resp = self._r("GET", cfg["path"], params=p)
                except requests.RequestException as e:
                    self.add("SKIPPED", f"XSS(reflected) {name}.{param}", str(e))
                    continue
                marker = f"xss-probe-{uid}"
                # 仅在 200 成功输出中判定反射；422/400 的校验错误回显不算输出反射
                reflected_raw = resp.status_code == 200 and marker in resp.text
                reflected_escaped = resp.status_code == 200 and f"&lt;b&gt;{marker}" in resp.text.replace(" ", "")
                # 对 HTML 响应用 BeautifulSoup 解析：若标记以真实 <b> 标签出现在解析树中，
                # 说明服务端确实未转义地渲染了 HTML(更强的 XSS 信号)
                rendered_html = False
                if reflected_raw and "html" in resp.headers.get("content-type", ""):
                    rendered_html = soup = BeautifulSoup(resp.text, "html.parser").find(id=marker)
                if rendered_html:
                    self.add(
                        "VULNERABLE",
                        f"XSS(rendered-html) {name}?{param}",
                        f"标记 {marker} 以真实 HTML 元素渲染到页面，可执行任意脚本",
                    )
                elif reflected_raw and not reflected_escaped:
                    self.add(
                        "VULNERABLE",
                        f"XSS(reflected) {name}?{param}",
                        f"标记 {marker} 被原样反射(未转义)。注：属于服务端输出编码缺陷，"
                        "最终能否执行取决于消费方(前端)是否转义渲染",
                    )
                elif reflected_raw:
                    self.add("OK", f"XSS(reflected) {name}?{param}", "标记虽反射但被正确转义")
                else:
                    self.add("OK", f"XSS(reflected) {name}?{param}", "标记未反射")

    def check_csrf(self) -> None:
        # 对状态变更端点发送"非法 body"，观察拒绝层：
        # 401/403 -> 有认证保护(令牌机制，CSRF 风险低)；200/2xx -> 无保护(危险)
        for name, cfg in POST_ENDPOINTS.items():
            path = cfg["path"]
            resp = self._r("POST", path, json={"__csrf_probe__": "invalid"})
            if cfg["public"]:
                if resp.status_code in (401, 403):
                    self.add("SUSPICIOUS", f"CSRF {name}",
                             f"公开端点却被拒绝于认证层 ({resp.status_code})，路径可能不对")
                else:
                    self.add("OK", f"CSRF {name}",
                             "公开端点，无认证要求(CSRF 仅信息性参考)")
            elif resp.status_code in (401, 403):
                self.add("OK", f"CSRF {name}", f"拒绝于认证层 ({resp.status_code})，令牌机制下 CSRF 风险低")
            elif resp.status_code == 422:
                self.add("OK", f"CSRF {name}", "拒绝于参数校验层(422)，载荷不会入库")
            elif resp.status_code < 500:
                self.add("VULNERABLE", f"CSRF {name}",
                         f"非法请求返回 {resp.status_code}，需人工确认是否可被跨站利用")
            else:
                self.add("SUSPICIOUS", f"CSRF {name}", f"返回 {resp.status_code}，需结合令牌方案判断")

    def check_access_control(self) -> None:
        for path in PROTECTED_ENDPOINTS:
            try:
                resp = self._r("GET", path)
            except requests.RequestException as e:
                self.add("SKIPPED", f"访问控制 {path}", str(e))
                continue
            if resp.status_code in (401, 403):
                self.add("OK", f"访问控制 {path}", f"未登录被拒 ({resp.status_code})")
            elif resp.status_code in (200, 201):
                self.add("VULNERABLE", f"访问控制 {path}",
                         f"未登录竟返回 {resp.status_code}，可能存在越权读取")
            else:
                self.add("SUSPICIOUS", f"访问控制 {path}", f"返回 {resp.status_code}")

    def check_bruteforce(self, username: str, wordlist: List[str]) -> None:
        if not wordlist:
            self.add("SKIPPED", "暴力破解", "未提供测试字典")
            return
        self.add("OK", "暴力破解(速率限制)", "开始限速探测")
        for i, pwd in enumerate(wordlist[:5], 1):
            try:
                resp = self._r(
                    "POST", f"{API_PREFIX}/auth/login/access-token",
                    data={"username": username, "password": pwd},
                )
            except requests.RequestException as e:
                self.add("SKIPPED", "暴力破解", str(e))
                return
            if resp.status_code == 200:
                self.add("VULNERABLE", "暴力破解(弱口令)",
                         f"用户名 {username!r} + 密码 {pwd!r} 登录成功")
                return
            time.sleep(1.5)  # 限速：尊重服务端速率限制，避免触发封禁
        self.add("OK", "暴力破解(弱口令)", f"5 次尝试均失败(可能被限速/无弱口令)")

    def check_public_paths(self) -> None:
        # 常见敏感路径探测：404=OK，200=暴露(注意 FastAPI 一律 404，未命中即安全)
        for p in ["/.env", "/.git/config", "/admin", "/swagger-ui", "/robots.txt"]:
            resp = self._r("GET", p)
            if resp.status_code == 200:
                self.add("SUSPICIOUS", f"敏感路径暴露 {p}", f"返回 200(长度 {len(resp.text)})")
            else:
                self.add("OK", f"敏感路径 {p}", f"返回 {resp.status_code}")

    # ---------------- 运行与报告 ----------------
    def run(self, brute: bool = False, brute_user: str = "", wordlist: List[str] = None) -> None:
        print(f"\n=== 目标: {self.target} (无害化探测，不修改数据) ===\n")
        self.check_headers()
        self.check_public_paths()
        self.check_sqli()
        self.check_xss()
        self.check_csrf()
        self.check_access_control()
        if brute:
            self.check_bruteforce(brute_user or "test", wordlist or ["123456", "password"])

        if self._rate_limited:
            self.add("OK", "速率限制(DoS 防护)",
                     f"探测中 {len(self._rate_limited)} 次请求被 429 拦截并成功退避，"
                     "说明目标有基于 IP 的限流，暴力破解/洪泛类攻击成本被抬高")

        ok = sum(1 for f in self.findings if f.status == "OK")
        vul = [f for f in self.findings if f.status == "VULNERABLE"]
        sus = [f for f in self.findings if f.status == "SUSPICIOUS"]
        print("\n=== 汇总 ===")
        print(f"  已执行: {len(self.findings)}   确认漏洞: {len(vul)}   疑似: {len(sus)}   通过: {ok}")
        if vul:
            print("  明确被利用成功的攻击:")
            for f in vul:
                print(f"    - {f.title}: {f.detail}")
        if sus:
            print("  需要人工复核的疑点:")
            for f in sus:
                print(f"    - {f.title}: {f.detail}")
        if not vul and not sus:
            print("  未发现可利用漏洞。")

    def to_json(self) -> str:
        return json.dumps([f.__dict__ for f in self.findings], ensure_ascii=False, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(description="无害化黑盒 Web 漏洞扫描器")
    ap.add_argument("--target", default="http://localhost:8000", help="目标站点根地址")
    ap.add_argument("--brute", action="store_true", help="开启暴力破解探测(默认关闭，需搭配 --user)")
    ap.add_argument("--user", default="test", help="暴力破解使用的测试用户名")
    ap.add_argument("--dict", default="123456,password,test123", help="弱口令字典(逗号分隔)")
    ap.add_argument("--delay", type=float, default=0.4, help="探测间隔秒数(默认0.4，尊重限速)")
    ap.add_argument("--json", metavar="FILE", help="额外输出 JSON 报告到文件")
    args = ap.parse_args()

    sc = Scanner(target=args.target, delay=args.delay)
    try:
        sc.run(brute=args.brute, brute_user=args.user,
               wordlist=[w.strip() for w in args.dict.split(",") if w.strip()])
    except KeyboardInterrupt:
        print("\n已中断。")
        sys.exit(1)

    if args.json:
        with open(args.json, "w") as f:
            f.write(sc.to_json())
        print(f"JSON 报告已写入 {args.json}")


if __name__ == "__main__":
    main()
