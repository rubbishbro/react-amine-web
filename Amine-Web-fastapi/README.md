# vscode构建环境
依赖项在requirements.txt

# 运行
先进入 Amine-Web-fastapi文件夹
```
./start.bat
```

# 教程
- python3教程：https://www.runoob.com/python3/python3-tutorial.html
- fastapi教程：https://www.runoob.com/fastapi/fastapi-tutorial.html
- Full Stack FastAPI Template:https://github.com/fastapi/full-stack-fastapi-template/tree/master(前端与咱们所用的不同)
- SQLModel入门：https://blog.csdn.net/xnuscd/article/details/144081478
- PostgreSQL教程：https://www.runoob.com/postgresql/postgresql-tutorial.html

# 数据库
数据库使用PostgreSQL

# 注意
当前没有env，直接运行会报错

# 文件结构
```
D:.
│  .gitignore
│  README.md
│  requirements.txt #虚拟环境依赖项
│  start.bat #运行后端
│
├─.log #日志文件夹
|
│
├─app
│  │  main.py #主函数
│  │
│  ├─api #路由器
│  │  │  api.py #路由器整合
│  │  │  deps.py #关于OAuth2验证
│  │  │
│  │  └─endpoints
│  │          auth.py #关于OAuth2验证的路由
│  │          interact.py #关于帖子点赞评论的路由
│  │          posts.py #关于帖子的路由
│  │          upload.py #关于上传至服务端文件的路由
│  │          users.py #关于用户的路由
│  │
│  ├─core
│  │  │  config.py #设置
│  │  │  security.py #用户身份校验与令牌生成
│  │  │
│  │  └─__pycache__
│  │
│  ├─crud #关于数据库的操作
│  │      crud_interact.py #关于帖子点赞评论的数据库操作
│  │      crud_post.py #关于帖子的数据库操作
│  │      crud_user.py #关于用户的数据库操作
│  │
│  ├─db #数据库
│  │      database.py #数据库初始化
│  │
│  ├─models #一些数据库存储结构
│  │      interact.py #关于帖子点赞评论的 数据库存储结构
│  │      post.py #关于帖子的 数据库存储结构
│  │      user.py #关于用户的 数据库存储结构
│  │      __init__.py
│  │
│  ├─schemas#一些数据库行为
│  │      interact.py #关于帖子点赞评论的 数据库行为
│  │      post.py #关于帖子的 数据库行为
│  │      token.py #关于token的 模型
│  │      user.py #关于用户的 数据库行为
│  │
│  └─__pycache__
│          main.cpython-314.pyc
│
├─Db
│  └─Users
├─Management
└─__pycache__
```