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
```

### 4. 启动数据库

确保 PostgreSQL 服务运行中，并创建数据库：
```bash
psql -U postgres
CREATE DATABASE AMINE_WEB;
\q
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
- `POST /` - 用户注册（邮箱和用户名唯一）
- `GET /me` - 获取当前用户信息
- `GET /username/{username}` - 根据用户名查询用户

### 认证模块 (`/api/v1/login`)
- `POST /access-token` - 登录（支持邮箱或用户名）

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

1. **注册/登录** → 获取 JWT Token
2. **后续请求** → 在 Header 中携带：
   ```
   Authorization: Bearer <your_token>
   ```
3. **Swagger 测试** → 点击右上角 🔓 Authorize 按钮输入 Token

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

## 📝 TODO

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