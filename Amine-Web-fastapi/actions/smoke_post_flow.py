"""本地端到端「发帖」冒烟测试。

为什么需要这个脚本
------------------
本地通常没有配置 SMTP，`POST /auth/email-code/send` 会直接返回
503 "Email service unavailable"（见 app/api/endpoints/auth.py:277-311），
所以走注册页拿不到验证码、也就没法注册账号来发帖。

这里换个思路：**直接在数据库里落一个已激活的测试账号**（不经过邮箱验证），
然后用真实的浏览器同款流程跑一遍：

    登录（拿 cookie） -> 校验 CSRF 真的生效 -> 发帖 -> 列表可见
    -> 评论 -> 删帖（回归：有评论的帖子必须能删掉，不能 500）

用法
----
1. 先启动后端（要求数据库可连、且已执行过迁移）：
       alembic upgrade head          # 补齐 post.views / is_pinned / pinned_at
       uvicorn app.main:app --reload
2. 再跑本脚本：
       python actions/smoke_post_flow.py

可选环境变量：
    SMOKE_BASE_URL  默认 http://127.0.0.1:8000/api/v1
    SMOKE_ORIGIN    默认 http://localhost:5173（必须命中后端 CORS 白名单，
                    否则所有写请求都会被 CSRF 中间件以 403 Origin not allowed 拦掉）
"""

from __future__ import annotations

import os
import sys

import httpx
from sqlmodel import Session, select

from app.core.security import get_password_hash
from app.db.database import engine
from app.models.user import User

BASE_URL = os.getenv("SMOKE_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
ORIGIN = os.getenv("SMOKE_ORIGIN", "http://localhost:5173")

EMAIL = "smoke.post.flow@example.com"
USERNAME = "smoke_post_flow"
PASSWORD = "smoke-post-flow-123"


def ensure_dev_user() -> int:
    """确保存在一个可用的本地测试账号，返回 user id（可重复执行）。"""
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == EMAIL)).first()
        if user:
            # 修掉可能被上一次测试改坏的状态
            user.is_active = True
            user.is_banned = False
            user.is_muted = False
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"  ✓ 复用已有测试账号 {EMAIL} (id={user.id})")
            return user.id

        user = User(
            email=EMAIL,
            username=USERNAME,
            hashed_password=get_password_hash(PASSWORD),
            userSchool="本地测试",
            userClass="冒烟测试",
            is_active=True,
            is_superuser=False,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"  ✓ 已创建测试账号 {EMAIL} / {PASSWORD} (id={user.id})")
        return user.id


def check(response: httpx.Response, expected, label: str) -> httpx.Response:
    expected_codes = (expected,) if isinstance(expected, int) else tuple(expected)
    if response.status_code not in expected_codes:
        print(f"  ❌ {label} 失败: HTTP {response.status_code}")
        print(f"     响应: {response.text[:500]}")
        raise SystemExit(1)
    print(f"  ✓ {label}: HTTP {response.status_code}")
    return response


def main() -> int:
    print(f"🎯 目标后端: {BASE_URL}   Origin: {ORIGIN}\n")

    print("1) 准备测试账号")
    user_id = ensure_dev_user()

    with httpx.Client(
        base_url=BASE_URL,
        timeout=20.0,
        headers={"Origin": ORIGIN},
    ) as client:
        print("\n2) 登录（浏览器同款 cookie 会话）")
        login = check(
            client.post("/auth/login", json={"identifier": EMAIL, "password": PASSWORD}),
            200,
            "POST /auth/login",
        )
        print(f"     当前用户: {login.json().get('username')} (id={login.json().get('id')})")

        csrf = client.cookies.get("aw_csrf_token")
        if not csrf:
            print("  ❌ 登录后没有拿到 aw_csrf_token cookie，后续写请求必然 403")
            return 1
        write_headers = {"X-CSRF-Token": csrf, "Content-Type": "application/json"}

        print("\n3) 校验 CSRF 是否真的在工作（带 cookie、不带 CSRF 头应被拒）")
        check(
            client.post(
                "/posts/",
                json={"title": "不应被创建", "content": "缺少 CSRF 头", "tags": []},
            ),
            403,
            "无 CSRF 头发帖被拒",
        )

        print("\n4) 发帖")
        created = check(
            client.post(
                "/posts/",
                headers=write_headers,
                json={
                    "title": "【冒烟测试】本地发帖链路",
                    "content": "# 冒烟测试\n\n这条帖子由 actions/smoke_post_flow.py 创建，稍后会被删除。",
                    "summary": "冒烟测试",
                    "category": "技术",
                    "tags": ["冒烟测试", "本地联调"],
                    "is_published": True,
                },
            ),
            (200, 201),
            "POST /posts/",
        ).json()
        post_id = created.get("id")
        print(f"     新帖 id={post_id} title={created.get('title')!r}")
        print(f"     后端返回作者: {created.get('author', {}).get('username')} (author_id={created.get('author_id')})")
        if created.get("author_id") != user_id:
            print("  ⚠️  author_id 与登录用户不一致，作者绑定可能有问题")

        print("\n5) 列表可见性")
        page = check(
            client.get("/posts/", params={"skip": 0, "limit": 50}), 200, "GET /posts/"
        ).json()
        ids = [item.get("id") for item in page.get("items", [])]
        if post_id not in ids:
            print(f"  ❌ 新帖 {post_id} 没有出现在列表里（total={page.get('total')}）")
            return 1
        print(f"     列表 total={page.get('total')}，已包含新帖")

        print("\n6) 给帖子加一条评论（为删帖回归造数据）")
        check(
            client.post(
                "/comments/",
                headers=write_headers,
                json={"post_id": post_id, "content": "冒烟测试评论：删帖时必须能连带清理"},
            ),
            (200, 201),
            "POST /comments/",
        )

        print("\n7) 删除这条带评论的帖子（回归：不能再触发外键冲突 500）")
        check(client.delete(f"/posts/{post_id}", headers=write_headers), 200, f"DELETE /posts/{post_id}")

        print("\n8) 确认已删除")
        check(client.get(f"/posts/{post_id}"), 404, f"GET /posts/{post_id} 应 404")

    print("\n✅ 发帖链路全绿：登录 -> CSRF -> 发帖 -> 列表 -> 评论 -> 删帖")
    return 0


if __name__ == "__main__":
    sys.exit(main())
