# React Amine Web 审查与修复报告

> 审查日期：2026-08-04  
> 审查范围：Vite/React 前端、FastAPI 后端、Vercel 部署、野草云生产服务器  
> 生产前端：<https://www.lnssy-cykj.online>  
> 生产 API：<https://api.lnssy-cykj.online>

## 1. 报告目的

本文档用于说明本轮审查中：

1. 发现了哪些问题；
2. 每个问题采用了什么修复方案；
3. 修改了哪些模块；
4. 如何验证修复有效；
5. 哪些风险仍然存在；
6. 出现问题时如何回滚。

本报告不包含服务器密码、数据库密码、JWT 密钥、邮件凭据或其他敏感值。

## 2. 变更概览

本轮共有三个已经推送到 GitHub `main` 分支的提交：

| 提交 | 内容 | 规模 |
| --- | --- | --- |
| `66d5115` | API 权限与数据安全、前端稳定性、Vercel 路由修复 | 53 个文件，+475 / -503 |
| `9c67f43` | 修复头像上传后无法显示 | 5 个文件，+35 / -13 |
| `659260d` | 重写“社团介绍”文案 | 1 个文件，+11 / -18 |

当前状态：

- GitHub/Vercel 前端对应最新提交：`659260d`
- 生产后端对应提交：`9c67f43`
- 这是预期状态，因为 `659260d` 只修改前端文案，不需要重启后端

## 3. 第一阶段：安全与稳定性修复

对应提交：`66d5115 fix: harden API permissions and stabilize production UI`

### 3.1 公开接口泄漏用户敏感字段

#### 原问题

多个公开接口直接返回完整的用户模型，其中包含不应公开的字段，例如：

- 邮箱；
- 密码哈希；
- 封禁/禁言记录等管理字段。

风险最高的是综合搜索接口 `/api/v1/search/all`。该接口原先没有严格的响应模型约束，SQLModel 对象可能被直接序列化。

#### 修复方案

- 新增 `UserPublic` 响应模型；
- 公开模型只保留用户名、头像、头图、学校、班级、简介、头衔等公开信息；
- 搜索、关注列表、公开资料和帖子作者统一改用 `UserPublic`；
- 为综合搜索增加明确的 `SearchAllResponse`；
- 帖子响应中的作者模型也改为公开模型。

#### 主要文件

- `Amine-Web-fastapi/app/schemas/user.py`
- `Amine-Web-fastapi/app/schemas/post.py`
- `Amine-Web-fastapi/app/api/endpoints/search.py`
- `Amine-Web-fastapi/app/api/endpoints/users.py`
- `Amine-Web-fastapi/app/api/endpoints/relations.py`

#### 验证

- 线上搜索接口返回 200；
- 递归检查返回 JSON 的所有字段，未发现 `hashed_password` 或 `email`；
- 公开用户接口继续正常返回头像、用户名等公开资料。

---

### 3.2 旧注册接口可以绕过邮箱验证

#### 原问题

系统已有邮箱验证码注册流程，但仍保留公开的 `POST /api/v1/users/`。调用者可以绕过验证码，直接创建账号。

#### 修复方案

- 删除旧的公开用户创建接口；
- 保留正式的邮箱验证码注册流程；
- 重构 `UserCreate`，不再继承包含管理员字段的基础模型；
- 增加用户名、密码、学校、班级等字段长度约束。

#### 验证

- 线上请求 `POST /api/v1/users/` 返回 404；
- 路由级回归检查确认该 POST 路由不存在；
- 构造注册数据时，即使传入 `is_superuser` 也不会进入模型输出。

---

### 3.3 草稿帖子被公开展示

#### 原问题

帖子列表和计数查询没有过滤 `is_published`，草稿可能出现在首页、分类列表或搜索结果中。通过帖子 ID 也可能直接读取草稿。

#### 修复方案

- 公共帖子列表和计数统一添加 `is_published = true` 条件；
- 获取单篇帖子时增加可选登录用户；
- 未发布帖子只允许作者本人或管理员查看；
- 对非法分页参数进行限制：`skip >= 0`，`1 <= limit <= 100`。

#### 主要文件

- `Amine-Web-fastapi/app/crud/crud_post.py`
- `Amine-Web-fastapi/app/api/endpoints/posts.py`

#### 验证

- 未登录访问草稿会得到 404；
- 已发布帖子列表和详情仍正常返回；
- 线上首页成功加载 5 条已发布帖子。

---

### 3.4 封禁用户仍能登录或调用受保护接口

#### 原问题

账号的 `is_banned` 状态没有在统一依赖中强制检查，导致封禁账号仍可能登录，或继续调用部分需要登录的接口。

#### 修复方案

- 登录时拒绝封禁账号；
- `get_current_active_user` 统一检查 `is_banned`；
- WebSocket 私信连接也拒绝封禁账号；
- JWT 的用户 ID 解析增加类型和格式异常处理。

#### 主要文件

- `Amine-Web-fastapi/app/api/deps.py`
- `Amine-Web-fastapi/app/api/endpoints/auth.py`
- `Amine-Web-fastapi/app/api/endpoints/dm.py`

---

### 3.5 私信文件下载存在路径穿越

#### 原问题

旧的私信下载接口把客户端提供的路径直接传入本地文件读取逻辑。攻击者可能构造 `../` 路径读取服务器上的任意文件，例如环境配置。

#### 修复方案

- 私信附件从公开的 `static/dm_upload` 移至 `private/dm_upload`；
- 下载前统一规范化对象 Key；
- 拒绝斜杠、反斜杠、`.`、`..` 和非允许扩展名；
- 使用 `Path.resolve()` 后再次确认文件仍在指定目录内；
- 下载接口必须登录；
- MIME 类型由服务器根据文件名判断，不再相信客户端输入；
- 七牛云下载地址改为正确的私有签名 URL；
- 异常响应不再把底层错误详情直接返回给客户端；
- FastAPI 只公开挂载 `/static/uploads`，不再公开整个 `/static` 目录。

#### 主要文件

- `Amine-Web-fastapi/app/api/endpoints/dm_upload.py`
- `Amine-Web-fastapi/app/main.py`

#### 验证

以下输入均被拒绝：

- `../../.env`
- `dm_upload/../../.env`
- `/etc/passwd`

合法的 `dm_upload/file.png` 可以被规范化为安全文件名。

---

### 3.6 私信权限边界不完整

#### 原问题

发送私信时没有完整确认：

- 收件人是否存在；
- 收件人是否处于可用状态；
- 任意一方是否已拉黑另一方；
- 消息长度是否合理。

#### 修复方案

- REST 和 WebSocket 两条发送链路统一验证收件人；
- 拒绝向停用或封禁账号发送消息；
- 双向检查拉黑关系；
- 消息正文限制为最多 2000 个字符；
- WebSocket 登录同样执行封禁检查。

---

### 3.7 客户端可以伪造通知

#### 原问题

前端可以直接调用通知推送接口，并自行指定通知类型和内容。恶意用户可以伪造关注、点赞等系统通知。

#### 修复方案

- 删除公开的 `POST /notifications/push`；
- 删除前端的客户端通知推送代码；
- 关注、评论回复、评论点赞和帖子点赞通知改为后端在业务操作成功后生成；
- 避免给操作人自己发送通知。

#### 主要文件

- `Amine-Web-fastapi/app/api/endpoints/notifications.py`
- `Amine-Web-fastapi/app/api/endpoints/comments.py`
- `Amine-Web-fastapi/app/api/endpoints/interact.py`
- `Amine-Web-fastapi/app/api/endpoints/relations.py`
- `Amine-Web-react/src/services/notificationsApi.js`
- `Amine-Web-react/src/pages/utils/notifications.js`

#### 验证

- 线上请求 `POST /api/v1/notifications/push` 返回 404；
- 正常业务通知由后端生成。

---

### 3.8 点赞与收藏可以作用于无效帖子

#### 原问题

互动接口没有在执行点赞/收藏前严格确认帖子存在且已发布。

#### 修复方案

- 点赞和收藏前先读取并验证帖子；
- 不允许对不存在或未发布的公共帖子执行互动；
- 帖子点赞成功后由后端生成通知。

---

### 3.9 CORS 配置过宽

#### 原问题

后端原先允许：

- 所有 HTTP 方法；
- 所有请求头；
- 暴露所有响应头；
- 携带凭据。

实际前端使用 Bearer Token，不依赖跨域 Cookie。

#### 修复方案

- `allow_credentials=False`；
- 方法限制为 GET、POST、PUT、PATCH、DELETE、OPTIONS；
- 请求头限制为 Authorization、Content-Type、Accept；
- 删除暴露所有响应头的配置；
- 保留正式域名和本地开发地址白名单。

---

## 4. 前端稳定性修复

### 4.1 ESLint 错误与 React Hooks 问题

#### 原问题

初始检查存在 28 个 ESLint 错误和 10 个警告，包括：

- 未使用变量和导入；
- Effect 中同步更新状态；
- 依赖数组不稳定；
- Hook 调用关系不清晰；
- 某些变量在声明前使用。

#### 修复方案

- 清理无效变量和导入；
- 调整 Effect 的依赖和取消逻辑；
- 使用 `useCallback`、`useMemo` 稳定引用；
- 将同步状态恢复调整为微任务，避免 Effect 级联渲染；
- 修复个人资料页中状态变量声明顺序问题；
- 重构社区未读数刷新与帖子统计同步逻辑。

#### 验证

- `npm run lint`：通过，0 错误；
- `npm run build`：通过。

---

### 4.2 用户 Context 重复嵌套

#### 原问题

`UserProvider` 同时出现在 `main.jsx` 和 `App.jsx`，导致全站存在两层独立用户状态：

- 可能重复请求当前用户；
- 内外层登录状态可能不一致；
- 点赞、收藏、头像等状态可能读取到不同 Context。

#### 修复方案

- 只在应用入口保留一个 `UserProvider`；
- 将 `UserContext`、`useUser` 和 `isProfileComplete` 拆到独立模块；
- Provider 文件只负责状态管理；
- 更新所有消费组件的导入路径。

此方案遵循 React Context 的单一 Provider 和稳定导出原则。

---

### 4.3 Vercel 子路径刷新返回 404

#### 原问题

Vercel 没有 SPA fallback。直接访问或刷新 `/login`、`/profile`、`/messages`、`/forum` 会返回 404。

#### 修复方案

在 `vercel.json` 中：

1. 保留 API rewrite；
2. 增加所有其他路径回退到 `/index.html`。

#### 验证

`/login`、`/forum` 等地址均返回 200，HashRouter 页面正常渲染。

---

### 4.4 背景图片构建路径错误

#### 原问题

多个 CSS 文件通过相对路径引用 `BackGround.png`，Vite 构建时无法稳定解析。

#### 修复方案

统一改为站点根路径：

```css
background-image: url('/BackGround.png');
```

涉及社团介绍、活动、同人、技术、季度新番、资源、论坛、音游等页面。

---

### 4.5 前端依赖风险

#### 处理内容

- `react-router-dom` 从 7.13.0 升级到 7.18.0；
- 重新生成 `package-lock.json`；
- 升级后重新执行 lint 和生产构建。

#### 尚存说明

`npm audit` 仍会报告：

- React Router 的 RSC/服务端框架模式公告；
- `react-markdown-editor-lite` 间接依赖的 nanoid 公告。

当前项目使用浏览器端 `HashRouter`，不使用 React Router RSC、Framework Mode 或服务端 action，因此已知 Router 告警所描述的执行路径不在当前架构中。nanoid 由编辑器以默认无参数方式调用，不进入公告描述的非整数参数路径。

没有为了追求“0 audit”强行跨主版本升级，以避免引入更大的运行时兼容风险。

## 5. 头像上传修复

对应提交：`9c67f43 fix: resolve uploaded avatars against API origin`

### 5.1 原问题

上传和数据库更新实际上都成功：

- `POST /api/v1/upload/` 返回 200；
- `PATCH /api/v1/users/me/avatar` 返回 200；
- 图片已保存在服务器 `static/uploads`。

但是后端返回的是相对地址：

```text
/static/uploads/<filename>.jpg
```

前端部署在 Vercel，浏览器会把该地址解释为：

```text
https://www.lnssy-cykj.online/static/uploads/<filename>.jpg
```

Vercel 的 SPA fallback 又会为该请求返回 `index.html`。最终状态是 HTTP 200，但内容类型是 `text/html`，浏览器无法把它解码为图片，因此表现为“上传不成功”。

### 5.2 修复方案

- 新增 `resolveMediaUrl()`；
- 相对媒体地址根据 `API_BASE_URL` 转换到 API 域名；
- 当前用户、公开用户、帖子作者和关注列表统一规范化头像/头图 URL；
- 上传接口返回值在进入表单前立即规范化，因此选图后预览也正常；
- 后端的新本地上传直接根据请求域名返回完整 URL；
- 后端上传异常不再泄漏底层错误。

### 5.3 兼容策略

没有直接修改数据库中的旧头像地址，也没有删除旧图片。

原因：

- 前端规范化可以立即兼容所有历史相对路径；
- 用户以后重新保存资料时会自然写入完整 URL；
- 避免为了显示问题批量修改生产数据。

### 5.4 线上验证

对当前头像进行了实际检查：

- API 图片请求状态：200；
- Content-Type：`image/jpeg`；
- 浏览器实际渲染地址指向 `api.lnssy-cykj.online`；
- 图片自然尺寸：256 × 253；
- 线上首页帖子头像已正常显示。

## 6. “社团介绍”文案调整

对应提交：`659260d content: refresh anime club introduction`

### 原问题

原文的轻松二次元风格方向正确，但存在：

- 大量删除线吐槽；
- 旁白互相插嘴；
- 强行发癫式表达；
- 兴趣标签堆砌过长；
- 女装等容易让读者不适或误解的规则描述；
- 关键信息被梗淹没。

### 修改原则

- 保留轻松、诙谐和二次元语境；
- 保留 2011 年动画作品和“世界线”等自然作品梗；
- 去掉删除线吐槽、旁白插嘴和过度发癫；
- 减少圈内标签堆砌；
- 用正常叙述表达社团历史、活动和部门分工；
- 强调新人无需资历证明、所有社员平等参与。

### 新结构

1. `2011 · 一切开始的地方`
2. `所以，E 社到底是干什么的？`
3. `部门介绍 · 分工协作，也一起玩`

### 验证

- 页面标题正确；
- 新文案已出现在生产页面；
- 旧“九位少女保护学校”等文本已经消失；
- 页面无浏览器运行错误。

## 7. 生产服务器运维改动

以下操作发生在生产服务器上，不全部属于 Git 提交。

### 7.1 上线前完整备份

备份目录：

```text
/root/backups/anime-predeploy-20260804T081143Z
```

包含：

- PostgreSQL custom-format 数据库备份；
- `.env`；
- 应用 systemd unit；
- Nginx 配置；
- `static` 上传文件；
- SHA-256 校验清单。

目录权限为 700，文件权限已限制。数据库备份已通过 `pg_restore --list` 校验，上传文件压缩包已通过解包列表校验。

注意：该备份目前只保存在同一台服务器，不能替代异地备份。

### 7.2 保留服务器本地数据

部署过程中保留了：

- `Amine-Web-fastapi/static/`；
- 旧环境备份；
- 旧日志；
- 服务器本地 CORS 配置改动。

原服务器 `config.py` 的本地改动被保存到：

```text
stash@{0}: codex-predeploy-server-config
```

新 Git 版本已经包含相同的正式域名白名单，因此没有重新应用 stash，避免产生冲突；stash 保留用于审查或恢复。

### 7.3 关闭 Uvicorn 公网直连

#### 原问题

Uvicorn 监听 `0.0.0.0:8000`，绕过 Nginx 也能从公网直接访问。

#### 修复方案

通过 systemd override 将启动参数改为：

```text
--host 127.0.0.1 --port 8000
```

当前实际监听：

```text
127.0.0.1:8000
```

公网只能通过 Nginx 的 443 端口访问 API。

### 7.4 环境文件权限

`.env` 原权限为 644，服务器上的其他本地用户可以读取。

现已改为：

```text
600 root:root
```

### 7.5 服务健康状态

部署后确认：

- `anime.service`：active；
- Nginx：active；
- PostgreSQL：active；
- Nginx 配置测试通过；
- API 根路径和帖子接口通过 HTTPS 返回 200；
- 正式服务未出现 error 级别日志。

## 8. 验证清单

### 本地

- `npm run lint`：通过；
- `npm run build`：通过；
- Python `compileall`：通过；
- FastAPI 应用导入：通过；
- Git whitespace 检查：通过。

### 安全回归

- 路径穿越输入被拒绝；
- 公开响应不含密码哈希和邮箱；
- 旧注册接口不可用；
- 伪造通知接口不可用；
- 草稿访问受限；
- 封禁账号统一受限。

### 线上浏览器

- 首页：正常，帖子成功加载；
- 登录页：正常；
- 论坛页：正常；
- 社团介绍：新文案已生效；
- 头像：请求和显示正常；
- 无 Vite 错误浮层。

## 9. 尚未解决或建议后续处理

### 高优先级

1. **服务器密码轮换**  
   服务器密码曾出现在对话中，应尽快修改。当前 SSH 公钥登录已经可用，轮换密码不会影响密钥登录。

2. **建立自动化数据库备份**  
   当前只有一次人工备份，并且与生产数据位于同一服务器。建议每天自动备份到独立对象存储，并定期执行恢复演练。

3. **确认 Alembic 基线**  
   应用代码显示迁移头为 `9f42c2b69d95`，但数据库中曾未查询到 `alembic_version` 表。后续新增数据库字段前，应先建立可靠的迁移基线，避免生产库与迁移历史脱节。

### 中优先级

4. **服务仍以 root 用户运行**  
   虽然 8000 端口已限制为本机访问，但应用进程仍是 root。建议把代码迁移到 `/opt/anime-web` 或 `/srv/anime-web`，创建专用低权限用户运行。

5. **缺少正式自动化测试套件**  
   当前主要依靠编译、静态检查、一次性安全断言和浏览器回归。建议增加 pytest API 测试和 Playwright 关键流程测试。

6. **前端主包偏大**  
   构建后的主 JavaScript 包约 793 KB，Vite 提示超过 500 KB。建议按路由懒加载管理页、编辑器和 Markdown 相关依赖。

7. **生产日志中存在大量自动扫描请求**  
   已观察到针对 PHP、WordPress、Git 配置等路径的公网扫描，均返回 404。建议后续配置 Nginx 限速、Fail2ban 或云厂商防火墙策略。

### 低优先级

8. **裸域名 DNS**  
   `www.lnssy-cykj.online` 正常，裸域名 `lnssy-cykj.online` 的地址记录仍需在 DNS 控制台确认并配置跳转。

9. **旧相对媒体 URL**  
   前端已经兼容，无需紧急迁移。若以后提供第三方 API，可考虑一次性把数据库中的 `/static/uploads/` 地址规范化为完整 URL。

## 10. 回滚建议

### 按提交回滚

- 仅回滚社团文案：revert `659260d`
- 仅回滚头像 URL 修复：revert `9c67f43`
- 回滚安全与前端稳定性修复：revert `66d5115`

安全提交不建议整体回滚。如果出现兼容问题，应优先针对具体模块修复。

### 服务器回滚

后端代码可以切回上线前提交，并重启 `anime.service`。如涉及数据问题，可使用预部署备份中的 PostgreSQL dump 和上传文件压缩包恢复。

systemd 的 localhost 绑定和 `.env` 权限收紧属于独立安全措施，即使回滚应用代码也建议保留。

## 11. 审查结论

本轮修复重点解决了四类问题：

1. **数据安全**：公开用户信息、草稿、文件读取和通知伪造；
2. **权限边界**：封禁账号、私信、互动和注册流程；
3. **生产稳定性**：Vercel 路由、React 状态、头像地址和构建错误；
4. **内容体验**：社团介绍文案。

核心修复已经部署并通过线上验证。当前系统可以继续运行，但数据库备份自动化、迁移基线、非 root 服务账户和自动化测试应作为下一阶段工作。
