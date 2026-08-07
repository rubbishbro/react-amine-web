# Amine Web 账户模块完整修复交付

日期：2026-08-07

## 1. 交付范围与版本

本次交付覆盖登录、注册、验证码、密码重置、浏览器会话、资料编辑、头像/头图上传、管理员激活和私信 WebSocket 鉴权。

- P0 紧急恢复：GitHub PR #54，生产提交 `9ccb94e`
- 后端会话与账户重构：GitHub PR #55，生产提交 `05166b3`
- 刷新令牌重放补丁：GitHub PR #57，生产提交 `e92b090`
- 前端 Cookie 会话迁移：GitHub PR #58，生产提交 `b56256d`
- 生产备份：`/root/backups/account-p0-20260807T071824Z`、`/root/backups/account-session-20260807T083344Z`
- 数据库迁移：无；继续使用现有 `hashed_password` 字段，会话、验证码和 WebSocket ticket 使用 Redis

## 2. 问题与具体修复

### P0-1：登录正确仍返回 500，前端显示 Failed to fetch

**根因**：SlowAPI 开启自动响应头注入后，受装饰器保护的端点没有注入 Starlette `Response`，业务函数完成后抛出 `parameter response must be an instance of starlette.responses.Response`。

**修复**：关闭 SlowAPI 自动响应头注入，但保留装饰器限流和 Redis 计数。统一限流中间件继续产生 429 和 `Retry-After`，因此不会失去限流能力。

**涉及文件**：`Amine-Web-fastapi/app/core/limiter.py`。

### P0-2：注册、重置、验证码和上传可能“实际成功但显示失败”

**根因**：这些接口使用了与登录相同的 SlowAPI 配置，数据库或文件操作完成后才在响应阶段抛出 500。

**修复**：与 P0-1 同步消除响应阶段异常，并新增成功路径回归测试，覆盖登录、验证码、注册、密码重置和上传类端点的限流包装行为。

**涉及文件**：`Amine-Web-fastapi/tests/test_security_boundaries.py`。

### P0-3：后端异常被浏览器伪装为网络故障

**根因**：未捕获异常的 500 响应没有稳定的 JSON、CORS 和请求标识，浏览器只能报告 `Failed to fetch`。

**修复**：最外层异常处理统一返回安全 JSON，附带请求 ID、CORS 和安全响应头；堆栈只留在服务器日志，不发给浏览器。

**涉及文件**：`Amine-Web-fastapi/app/main.py`。

### P1-1：JWT 保存在 localStorage，登录状态只有 30 分钟且无法刷新

**根因**：网页直接持有长期 Bearer Token，XSS 可读取，访问令牌过期后只能重新登录。

**修复**：

- 网页登录改为 15 分钟 HttpOnly/Secure/SameSite=Lax 访问 Cookie；
- 新增 7 天刷新 Cookie并在每次刷新时强制轮换；
- 新增可读 CSRF Cookie，写请求自动携带 `X-CSRF-Token`；
- 前端停止签发和保存新 localStorage JWT，只读取一次旧令牌用于迁移，成功后立即删除；
- 新增单标签页共享刷新 Promise，并使用 Web Locks 协调多标签页刷新。

**涉及文件**：`app/api/endpoints/auth.py`、`app/core/session_store.py`、`app/core/csrf.py`、`src/services/apiClient.js`、`src/services/auth.js`、`src/pages/context/UserContext.jsx`。

### P1-2：退出、重置密码和封禁后旧令牌仍可使用

**根因**：旧 JWT 为完全无状态令牌，服务端没有会话记录和撤销能力。

**修复**：JWT 增加 `sid`、`jti`、`iat`、issuer 和 audience；Redis 保存会话、刷新令牌哈希、CSRF 哈希及用户会话集合。普通退出撤销当前会话，密码重置、封禁和删除用户撤销该用户全部会话。

**涉及文件**：`app/core/security.py`、`app/core/session_store.py`、`app/api/endpoints/auth.py`、`app/api/endpoints/admin.py`、`app/api/deps.py`。

### P1-3：刷新令牌重放不能可靠触发会话撤销

**根因**：旧 CSRF 哈希会在刷新轮换逻辑之前拦截旧 Cookie 对，使请求只得到普通 403，无法识别刷新令牌重放。

**修复**：刷新接口仍要求精确 Origin，且 CSRF Cookie 必须与请求头常量时间匹配；仅将 Redis CSRF 哈希检查交给原子的刷新轮换层。旧刷新令牌再次出现时，服务器撤销整个会话，新令牌也立即失效。

**涉及文件**：`app/core/csrf.py`、`tests/test_account_sessions.py`。

### P1-4：网络或 5xx 会被前端误判为凭据失效并强制退出

**根因**：原 UserContext 对 `/users/me` 的所有失败都清除 Token 和用户状态。

**修复**：统一请求层只在 401 时尝试一次共享刷新；刷新确认失败后才触发会话过期。403、429、5xx 和网络错误保留本地用户快照，不再误删会话。

**涉及文件**：`src/services/apiClient.js`、`src/pages/context/UserContext.jsx`。

### P1-5：邮箱大小写可能导致登录失败，错误信息可用于枚举账户

**根因**：注册邮箱会转小写，登录查询却按输入原样精确匹配；不存在账户时没有执行同等成本的密码校验。

**修复**：包含 `@` 的登录标识统一转小写，用户名保持原有大小写规则；无论用户是否存在都执行 dummy password hash，并返回统一的凭据错误。

**涉及文件**：`app/api/endpoints/auth.py`、`app/crud/crud_user.py`、`src/pages/login/index.jsx`。

### P1-6：bcrypt 静默截断 72 字节密码

**根因**：旧 bcrypt 只校验前 72 字节，超长密码可能被当成同一个密码。

**修复**：新密码改用 Argon2id（19 MiB、2 次迭代、并行度 1），限制 8–128 字符；旧 bcrypt 账户成功登录后自动升级哈希，不修改用户密码。

**涉及文件**：`app/core/security.py`、`app/crud/crud_user.py`、`requirements.txt`。

### P1-7：资料保存会前端假成功，冲突或后端失败仍跳转

**根因**：原实现先乐观写本地缓存并吞掉后端异常，头像与基本资料还分两次请求，可能只保存一半。

**修复**：`PATCH /users/me` 原子更新昵称、学校、班级、简介、头像和头图；前端等待后端成功后才更新状态和跳转。失败时保留当前表单并显示错误，保存按钮增加 loading 防止重复提交。

**涉及文件**：`app/api/endpoints/users.py`、`src/services/auth.js`、`src/pages/context/UserContext.jsx`、`src/pages/profile/index.jsx`。

### P1-8：学校、班级、简介、头像和头图无法清空，旧缓存会复活

**根因**：空字符串被前端转成 `undefined`，后端无法区分“不修改”和“清空”；标准化用户数据时又从旧 localStorage 回填媒体地址。

**修复**：空字符串明确表示清除；后端返回空值后不再从旧资料缓存恢复。保留旧头像接口用于兼容，但新版页面只使用原子资料接口。

**涉及文件**：`app/api/endpoints/users.py`、`src/services/auth.js`、`src/pages/context/UserContext.jsx`。

### P1-9：头像/头图上传重复提交且错误状态不清晰

**根因**：上传期间文件控件仍可操作，保存又会吞掉头像写库失败。

**修复**：头像和头图分别增加上传中状态、禁用重复选择并展示后端错误；上传获得 URL 后随整份资料一次性保存，失败不跳转。

**涉及文件**：`src/pages/profile/index.jsx`、`src/services/auth.js`。

### P1-10：WebSocket URL 暴露长期 JWT

**根因**：私信连接把 Bearer Token 放在 URL 查询参数，可能进入代理和访问日志。

**修复**：新增 60 秒、单次使用的 Redis ticket；连接和每次重连前通过 Cookie/CSRF 请求新 ticket，WebSocket URL 只携带短期票据。后端同时校验 Origin、用户/IP连接数和事件频率。

**涉及文件**：`app/api/endpoints/dm.py`、`app/core/session_store.py`、`src/services/dmWsClient.js`、`src/pages/messages/index.jsx`。

### P1-11：读取私信线程会产生“标记已读”副作用

**根因**：GET 线程接口同时修改状态，不符合安全 GET 语义，也不利于缓存和重放控制。

**修复**：GET 只读取；前端读取成功后显式调用 `POST /dm/thread/{id}/read`。

**涉及文件**：`app/api/endpoints/dm.py`、`src/services/dmApi.js`、`src/pages/messages/index.jsx`。

### P1-12：管理员激活只需要共享密钥

**根因**：密钥一旦泄露，已登录普通账户可直接提升权限。

**修复**：激活同时要求当前账户密码与管理员密钥，管理员密钥使用常量时间比较，限制用户/IP 每小时 3 次，并写入审计日志。

**涉及文件**：`app/api/endpoints/admin.py`、`src/services/adminApi.js`、`src/pages/profile/index.jsx`。

### P2-1：验证码发送、校验和消费不可靠

**根因**：邮件失败可能留下冷却记录；错误次数没有独立上限；成功验证码可能在数据库事务完成前被消费。

**修复**：SMTP 接受邮件后才写入 Redis；每个邮箱和用途独立计数，错误 5 次立即失效；注册/重置数据库提交成功后再消费验证码；发送失败返回统一 503，不泄露 SMTP 细节。

**涉及文件**：`app/core/code_store.py`、`app/api/endpoints/auth.py`。

### P2-2：注册唯一冲突可能产生不清晰错误

**根因**：邮箱或用户名并发冲突可能以数据库异常形式返回。

**修复**：捕获唯一约束冲突并回滚事务，返回 409；不会产生半注册账户。

**涉及文件**：`app/api/endpoints/auth.py`。

### P2-3：缺少账户模块真实回归测试

**根因**：原测试没有覆盖 Cookie、刷新轮换、旧密码升级、CSRF、资料清空和 WebSocket ticket。

**修复**：新增账户与会话测试，覆盖 Argon2/旧 bcrypt、JWT claims、Cookie 属性、刷新轮换与重放、CSRF、邮箱大小写、资料原子清空，以及 P0 成功响应链路。

**涉及文件**：`tests/test_account_sessions.py`、`tests/test_security_boundaries.py`。

## 3. 新增与兼容接口

- `POST /api/v1/auth/login`：浏览器 Cookie 登录
- `POST /api/v1/auth/refresh`：刷新并轮换会话
- `POST /api/v1/auth/logout`：撤销当前设备会话
- `POST /api/v1/auth/session/migrate`：旧 localStorage Bearer 一次性迁移
- `POST /api/v1/dm/ws-ticket`：签发一次性 WebSocket ticket
- `POST /api/v1/dm/thread/{id}/read`：显式标记私信已读
- `POST /api/v1/login/access-token`：暂时保留旧 Bearer 兼容；新版网页不再调用
- `PATCH /api/v1/users/me/avatar`：暂时保留旧调用兼容；新版网页使用原子 `PATCH /users/me`

## 4. 验证结果

### 自动化

- 后端：`21 passed`
- 前端 ESLint：通过
- 前端 Vite 生产构建：通过
- 构建仅保留既有的 bundle 大小警告，不影响本次账户功能

### 生产低频端到端复测

- Cookie 登录：200
- Cookie 获取当前用户：200
- 缺少 CSRF 的资料写入：403
- 资料字段原子清空：200
- 刷新令牌轮换：200
- 旧刷新令牌重放：401
- 重放后新访问令牌失效：401
- 旧 Bearer 登录及读取用户：200
- Cookie 退出：200；退出后读取用户：401
- 临时测试账户残留：0
- 后端服务状态：active

### Vercel 生产浏览器验收

- 邮箱和密码登录成功，并进入资料页
- 刷新页面后仍保持登录，HttpOnly Cookie 会话恢复正常
- 学校、班级和简介写入成功，公开资料页立即显示新值
- 学校、班级和简介清空成功，刷新后没有被旧 localStorage 缓存恢复
- 退出后自动回到登录页；再次刷新仍为未登录状态
- 浏览器 localStorage 中不存在 `aw_access_token`
- 退出后账户 Cookie 已清除
- 临时浏览器测试账户已精确删除，残留为 0
- Vercel 对生产提交 `b56256d` 的部署状态为 success

## 5. 发布与回滚

发布顺序已按 P0 热修、兼容会话版、刷新重放补丁、Cookie 会话前端执行。前端是在后端兼容版稳定后发布，旧 Bearer 接口因此没有在切换期间中断现有用户。

回滚时先回退前端到上一个 Vercel 生产版本；后端可将 Git 工作树回退到备份所记录的提交并恢复对应 `.env`、Nginx 配置。Redis 会话数据不是业务主数据，回滚旧认证时可清空 `auth:`、`ws:` 相关命名空间，但不得清空验证码或其他业务 Redis 键。数据库本轮没有 Schema 迁移。

## 6. 已知非阻断项

- Pydantic class-based Config、FastAPI `on_event` 和 `datetime.utcnow()` 有弃用警告，当前不影响账户功能，建议后续单独升级。
- 前端生产 bundle 约 796 kB，建议后续按路由拆包；不属于账户故障。
- 本轮没有向真实邮箱发送测试验证码，避免对第三方 SMTP 产生测试邮件；验证码存储、错误次数、事务顺序由自动化测试覆盖。
- 旧 Bearer 接口为兼容窗口，待确认所有客户端完成 Cookie 迁移后可另行下线。
- Cloudflare 注入的 Insights 统计脚本被当前 `script-src 'self'` CSP 拦截；账户功能不受影响。为避免扩大脚本执行面，本轮没有放宽 CSP。若后续需要统计，应明确添加 Cloudflare 官方域名和完整 `connect-src` 规则后再复测。
