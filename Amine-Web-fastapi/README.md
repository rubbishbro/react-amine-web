# Amine Web Backend API

基于 FastAPI + SQLModel + PostgreSQL 的现代化后端服务。

## 📦 技术栈

- **FastAPI** - 高性能异步 Web 框架
- **SQLModel** - 类型安全的 ORM（基于 SQLAlchemy + Pydantic）
- **PostgreSQL** - 关系型数据库
- **JWT** - 用户认证
- **Passlib + Bcrypt** - 密码加密

## 🚀 快速开始

### 1. 环境准备

确保已安装：
- Python 3.11+
- PostgreSQL 12+
- Conda（推荐）

### 2. 安装依赖

使用 Anaconda 环境（推荐）：
```bash
conda create -n web python=3.11
conda activate web
pip install -r requirements.txt
```

或使用系统 Python：
```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

创建 `.env` 文件：
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=AMINE_WEB
SECRET_KEY=your-super-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 邮箱验证码（开发环境可先不配 SMTP，使用调试模式）
EMAIL_CODE_DEBUG=true
EMAIL_CODE_EXPIRE_MINUTES=10
EMAIL_CODE_SEND_COOLDOWN_SECONDS=60

# 生产环境建议配置 SMTP（用于真实发送邮箱验证码）
# SMTP_HOST=smtp.qq.com
# SMTP_PORT=587
# SMTP_USERNAME=your_email@example.com
# SMTP_PASSWORD=your_email_auth_code
# SMTP_FROM_EMAIL=your_email@example.com
# SMTP_USE_TLS=true
```

> **💡 提示**: CORS 配置在 `app/main.py` 中直接设置，如需修改域名请编辑该文件。

### 4. 启动数据库

确保 PostgreSQL 服务运行中，并创建数据库：
```bash
psql -U postgres
CREATE DATABASE amine_web;
\q
```
第二次启动：
```bash
psql -U postgres
\c amine_web
```

### 5. 运行服务

```bash
uvicorn app.main:app --reload
```

访问：
- **API 文档**：http://localhost:8000/docs
- **备用文档**：http://localhost:8000/redoc

## 📚 API 功能(在api文档中测试)

### 用户模块 (`/api/v1/users`)
- `POST /` - 用户注册（邮箱和用户名唯一，兼容旧接口）
- `GET /me` - 获取当前用户信息
- `GET /username/{username}` - 根据用户名查询用户

### 认证模块 (`/api/v1/login`)
- `POST /access-token` - 登录（支持邮箱或用户名，前端当前使用邮箱登录）
- `POST /auth/email-code/send` - 发送邮箱验证码（`purpose=register` 或 `reset_password`）
- `POST /auth/register-email` - 邮箱 + 验证码注册
- `POST /auth/password-reset` - 邮箱 + 验证码重置密码

### 帖子模块 (`/api/v1/posts`)
- `GET /` - 获取帖子列表（支持分页）
- `POST /` - 创建帖子（需登录）
- `GET /{id}` - 获取帖子详情
- `PUT /{id}` - 更新帖子（需作者本人）
- `DELETE /{id}` - 删除帖子（需作者本人）

### 互动模块 (`/api/v1/interact`)
- `POST /` - 点赞/收藏帖子
- `GET /user/{user_id}` - 获取用户的互动记录

### 上传模块 (`/api/v1/upload`)
- `POST /` - 上传文件（需登录，支持图片/音频，最大10MB）

### 用户关系模块 (`/api/v1/users`)
- `POST /{user_id}/follow` - 关注用户
- `DELETE /{user_id}/follow` - 取消关注
- `POST /{user_id}/block` - 拉黑用户
- `DELETE /{user_id}/block` - 取消拉黑
- `GET /{user_id}/followers` - 获取粉丝列表
- `GET /{user_id}/following` - 获取关注列表
- `GET /me/blocked` - 获取拉黑列表
- `GET /{user_id}/relation` - 查询关系状态
- `GET /{user_id}/stats` - 获取关注/粉丝统计

### 评论模块 (`/api/v1/comments`)
- `POST /` - 创建评论（支持嵌套回复）
- `GET /post/{post_id}` - 获取帖子评论列表
- `GET /{comment_id}/replies` - 获取评论的回复
- `PUT /{comment_id}` - 更新评论（仅作者）
- `DELETE /{comment_id}` - 删除评论（软删除）
- `POST /{comment_id}/like` - 点赞评论
- `GET /post/{post_id}/count` - 获取评论总数

### 搜索模块 (`/api/v1/search`)
- `GET /posts?q=关键词` - 搜索帖子（关键词或Tag）
- `GET /users?q=关键词` - 搜索用户
- `GET /all?q=关键词` - 综合搜索（同时搜索帖子和用户）
  - 以 `#` 开头进行Tag搜索（如：`#动漫`）
  - 普通关键词搜索标题和内容

## 🔐 认证流程

1. **注册/登录** → 获取 JWT Token（推荐邮箱主流程）
    - 发送验证码：`POST /api/v1/auth/email-code/send`
    - 邮箱注册：`POST /api/v1/auth/register-email`
    - 邮箱登录：`POST /api/v1/login/access-token`
    - 忘记密码：`POST /api/v1/auth/password-reset`
2. **后续请求** → 在 Header 中携带：
   ```
   Authorization: Bearer <your_token>
   ```
3. **Swagger 测试** → 点击右上角 🔓 Authorize 按钮输入 Token

> **💡 开发提示**：当 `EMAIL_CODE_DEBUG=true` 且未配置 SMTP 时，发送验证码接口会在响应中返回 `debug_code`，便于本地联调。

## 🗄️ 数据库管理

### 查看数据库
```bash
psql -U postgres -d AMINE_WEB
\dt        # 查看所有表
\d user    # 查看 user 表结构
```

### 重置数据库（开发环境）
```bash
python actions/reset_db.py
```

⚠️ **警告**：会删除所有数据！

## 📁 项目结构

```
Amine-Web-fastapi/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── api/
│   │   ├── api.py           # 路由汇总
│   │   ├── deps.py          # 依赖注入（鉴权）
│   │   └── endpoints/       # API 端点
│   │       ├── auth.py      # 登录认证
│   │       ├── users.py     # 用户管理
│   │       ├── posts.py     # 帖子 CRUD
│   │       ├── interact.py  # 互动（点赞/收藏）
│   │       └── upload.py    # 文件上传
│   ├── core/
│   │   ├── config.py        # 配置管理（读取 .env）
│   │   └── security.py      # JWT 生成/密码加密
│   ├── crud/                # 数据库操作层
│   │   ├── crud_user.py
│   │   ├── crud_post.py
│   │   └── crud_interact.py
│   ├── db/
│   │   └── database.py      # 数据库连接
│   ├── models/              # SQLModel 数据库模型
│   │   ├── user.py
│   │   ├── post.py
│   │   └── interact.py
│   └── schemas/             # Pydantic 数据验证
│       ├── user.py
│       ├── post.py
│       ├── interact.py
│       └── token.py
├── static/uploads/          # 本地上传文件存储
├── actions/
│   └── reset_db.py          # 数据库重置脚本
├── .env                     # 环境变量配置
├── requirements.txt         # Python 依赖
└── README.md
```

## 🔧 开发工具

### API 测试

**方法 1: Python 自动化测试**
```bash
python -m actions.test_api
```

**方法 2: 浏览器 CORS 测试（推荐）**
```bash
# 启动测试服务器
python actions/start_cors_test.py

# 然后在浏览器访问
# http://localhost:5173/cors-test.html
```

> **⚠️ 重要**: 
> - 不要直接双击 `cors-test.html`（file:// 协议无法测试 CORS）
> - 必须通过 HTTP 服务器访问（上面的命令会自动启动）
> - Python 测试脚本可能显示 CORS 警告（requests 库的行为），这是正常的
> - **浏览器测试**可以真实验证 CORS 配置是否正常工作

### 代码规范
- 遵循 PEP 8 风格
- 使用类型注解
- 函数和类添加文档字符串

### 常用命令
```bash
# 查看依赖
pip list

# 导出依赖
pip freeze > requirements.txt

# 运行测试
pytest

# 格式化代码
black app/
```

## 📖 参考资源

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [SQLModel 文档](https://sqlmodel.tiangolo.com/)
- [PostgreSQL 教程](https://www.runoob.com/postgresql/postgresql-tutorial.html)
- [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)

## 🐛 常见问题

### 1. 数据库连接失败
- 检查 PostgreSQL 服务是否运行
- 确认 `.env` 中的数据库密码正确
- 确保数据库 `AMINE_WEB` 已创建

### 2. bcrypt 版本问题
如遇到 `password cannot be longer than 72 bytes` 错误：
```bash
pip install bcrypt==4.1.3
```

### 3. 环境变量未生效
确保 `.env` 文件在项目根目录，且 `pydantic-settings` 已安装。

### 4. PostgreSQL 服务启动

**Windows (需要管理员权限)**：
```powershell
# 启动服务
net start postgresql-x64-16

# 停止服务
net stop postgresql-x64-16

# 或使用 pg_ctl
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
```

**Linux / macOS**：
```bash
# 启动服务
sudo service postgresql start

# 查看状态
sudo service postgresql status

# 连接数据库
psql -U postgres
```

### 5. 后端调试

**使用 VS Code 调试器**：

创建 `.vscode/launch.json`：
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "FastAPI Debug",
            "type": "python",
            "request": "launch",
            "module": "uvicorn",
            "args": [
                "app.main:app",
                "--reload",
                "--host", "0.0.0.0",
                "--port", "8000"
            ],
            "jinja": true,
            "justMyCode": false,
            "env": {
                "PYTHONPATH": "${workspaceFolder}"
            }
        }
    ]
}
```

然后按 **F5** 启动调试，可以在代码中设置断点。

## � 生产环境部署配置

### ⚠️ 部署前必须修改的配置项

#### 1. CORS 配置 ([main.py](app/main.py))

**当前配置（开发环境）**：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    ...
)
```

**生产环境修改为**：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",           # 你的生产域名
        "https://www.yourdomain.com",       # www 子域名
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # 只允许必要的方法
    allow_headers=["Content-Type", "Authorization"],  # 只允许必要的头部
)
```

#### 2. 数据库配置 ([main.py](app/main.py))

**性能优化建议**：
- 修改 [crud_post.py](app/crud/crud_post.py) 中的 `get_multi` 函数
- 当前使用 `limit=1000` 是为了兼容前端假分页
- 生产环境应改为真实分页（如 `limit=20`）
- 前端需要相应修改为滚动加载或页码分页

#### 3. 静态资源存储 ([upload.py](app/api/endpoints/upload.py))

**当前配置**：本地文件存储（`static/uploads/`）

**生产环境建议**：
- 接入对象存储服务（阿里云 OSS / 腾讯云 COS / AWS S3）
- 优点：CDN 加速、海量存储、高可用性
- 修改 `upload.py` 中的文件保存逻辑

#### 4. JWT 密钥配置 (`.env`)

**必须修改**：
```env
SECRET_KEY=your-super-secret-key-change-this  # ❌ 请更换为强密码
ACCESS_TOKEN_EXPIRE_MINUTES=30                # 可根据需求调整
```

生成强密钥：
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 5. 数据库连接池配置

在高并发场景下，修改 [database.py](app/db/database.py) 添加连接池配置：
```python
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_size=20,           # 连接池大小
    max_overflow=40,        # 最大溢出连接
    pool_pre_ping=True,     # 连接检查
)
```

#### 6. HTTPS 部署

**必须使用 HTTPS**：
- JWT Token 在 Authorization 头中传输
- 使用 Nginx 反向代理 + Let's Encrypt 证书
- 配置示例：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 7. 安全加固

- 关闭 Swagger 文档访问（生产环境）
- 添加 API 限流（防止 DDoS）
- 配置日志记录系统
- 定期备份数据库

### 📋 生产部署检查清单

- [ ] 修改 CORS 白名单为生产域名
- [ ] 更换 JWT SECRET_KEY 为强密钥
- [ ] 配置对象存储服务（替代本地上传）
- [ ] 调整数据库分页参数（前后端同步）
- [ ] 配置数据库连接池
- [ ] 设置 HTTPS 证书
- [ ] 关闭或限制 Swagger 文档访问
- [ ] 添加 API 限流中间件
- [ ] 配置日志和监控
- [ ] 设置数据库自动备份
- [ ] 环境变量使用系统级配置（不提交 .env 到 Git）

---

## �📝 TODO

### 核心功能
- [x] 用户关系系统
  - [x] 创建 `UserRelation` 表（关注/拉黑/屏蔽）
  - [x] 实现关注/取消关注 API
  - [x] 实现拉黑/取消拉黑 API
  - [x] 获取粉丝列表/关注列表
  - [ ] 前端迁移 `localStorage` 到后端 API
  
- [x] 搜索功能
  - [x] 帖子全文搜索（标题/内容）
  - [x] Tag 标签搜索（以 # 开头）
  - [x] 用户名搜索
  - [x] 搜索结果分页和排序
  - [x] 前端搜索页面和路由
  
- [x] 评论系统
  - [x] 创建 `Comment` 表
  - [x] 评论 CRUD API
  - [x] 评论点赞功能
  - [x] 评论嵌套回复

### 优化改进
- [ ] 接入对象存储（阿里云 OSS / 七牛云）
- [ ] 添加管理员后台接口
- [ ] 单元测试覆盖
- [ ] API 限流（防止滥用）
- [ ] 日志系统优化
- [ ] Docker 部署支持

## 📄 License

MIT License