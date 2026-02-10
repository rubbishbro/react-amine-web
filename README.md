# Amine Web - 动漫社区平台

<div align="center">

**一个现代化的动漫主题社区平台**

[English](#english) | [中文](#chinese)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

</div>

---

<a name="chinese"></a>

## 📖 项目简介

本项目是由 **辽宁省实验中学动漫社的同学们呢** 开发的开源社区平台，致力于为动漫爱好者提供一个分享创作、交流想法的空间。

### ✨ 核心特性

- 🎨 **内容创作** - 支持 Markdown 编辑，丰富的排版功能
- 🖼️ **媒体支持** - 图片上传、音频分享
- 👥 **社交互动** - 点赞、收藏、评论、关注
- 🔐 **安全认证** - JWT 身份验证，密码加密存储
- 🏷️ **标签系统** - 灵活的内容分类和搜索
- 📱 **响应式设计** - 适配多种设备尺寸

### 🛠️ 技术栈

**前端**
- React 18 + React Router
- Vite (构建工具)
- Markdown 渲染支持
- CSS Modules

**后端**
- FastAPI (异步 Web 框架)
- SQLModel + PostgreSQL (数据持久化)
- JWT 认证
- Passlib + Bcrypt (密码加密)

### 📦 项目结构

```
react-amine-web/
├── Amine-Web-react/     # 前端 React 应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 可复用组件
│   │   └── services/    # API 服务
│   └── public/          # 静态资源
│
└── Amine-Web-fastapi/   # 后端 FastAPI 服务
    ├── app/
    │   ├── api/         # API 路由
    │   ├── models/      # 数据库模型
    │   ├── crud/        # 数据库操作
    │   └── core/        # 核心配置
    └── static/          # 上传文件存储
```

### 🚀 快速开始

#### 前端

```bash
cd Amine-Web-react
npm install
npm run dev
```

访问 http://localhost:5173

#### 后端

```bash
cd Amine-Web-fastapi
conda activate web  # 或使用你的 Python 环境
uvicorn app.main:app --reload
```

API 文档：http://localhost:8000/docs

详细文档请查看：
- [前端 README](./Amine-Web-react/README.md)
- [后端 README](./Amine-Web-fastapi/README.md)

### 👥 开发团队

**核心开发者**
- [@rubbishbro](https://github.com/rubbishbro) - 项目负责人/后端开发
- [@Lilizi-ovo](https://github.com/Lilizi-ovo) - 前端开发
- [@kondaidaidaisuki-dot](https://github.com/kondaidaidaisuki-dot) - 前端开发

### 📝 贡献指南

欢迎提交 Pull Request！请确保：
1. 代码风格符合项目规范
2. 提交前进行充分测试
3. 提供清晰的 commit message

### 📄 开源协议

本项目采用 [MIT License](./LICENSE) 开源协议。

---

<a name="english"></a>

## 📖 About

This project is an open-source community platform developed by **students from liaoning province shiyan high school amine club**, dedicated to providing anime enthusiasts with a space to share creations and exchange ideas.

### ✨ Key Features

- 🎨 **Content Creation** - Markdown editor with rich formatting
- 🖼️ **Media Support** - Image upload, audio sharing
- 👥 **Social Interaction** - Like, favorite, comment, follow
- 🔐 **Secure Authentication** - JWT-based auth with encrypted passwords
- 🏷️ **Tag System** - Flexible content categorization and search
- 📱 **Responsive Design** - Adapts to various screen sizes

### 🛠️ Tech Stack

**Frontend**
- React 18 + React Router
- Vite (Build Tool)
- Markdown Rendering
- CSS Modules

**Backend**
- FastAPI (Async Web Framework)
- SQLModel + PostgreSQL (Data Persistence)
- JWT Authentication
- Passlib + Bcrypt (Password Hashing)

### 🚀 Quick Start

#### Frontend

```bash
cd Amine-Web-react
npm install
npm run dev
```

Visit http://localhost:5173

#### Backend

```bash
cd Amine-Web-fastapi
conda activate web  # Or use your Python environment
uvicorn app.main:app --reload
```

API Docs: http://localhost:8000/docs

For detailed documentation:
- [Frontend README](./Amine-Web-react/README.md)
- [Backend README](./Amine-Web-fastapi/README.md)

### 👥 Team

**Core Developers**
- [@rubbishbro](https://github.com/rubbishbro) - Project Lead/Backend Developer
- [@Lilizi-ovo](https://github.com/Lilizi-ovo) - Frontend Developer
- [@kondaidaidaisuki-dot](https://github.com/kondaidaidaisuki-dot) - Frontend Developer

### 📝 Contributing

Pull requests are welcome! Please ensure:
1. Code follows project conventions
2. Changes are well-tested
3. Commit messages are clear and descriptive

### 📄 License

This project is licensed under the [MIT License](./LICENSE).