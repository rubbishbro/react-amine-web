# 所需要的库
- fastapi[all]
- sqlmodel
- asyncpg

# 配置
进入main.py

修改Log.log.LOG_DIR为你的日志路径

修改fastapi目录

# 运行
先进入 Amine-Web-fastapi文件夹
```
uvicorn main:app --reload
```

# 教程
- python3教程：https://www.runoob.com/python3/python3-tutorial.html
- fastapi教程：https://www.runoob.com/fastapi/fastapi-tutorial.html
- Full Stack FastAPI Template:https://github.com/fastapi/full-stack-fastapi-template/tree/master(前端与咱们所用的不同)
- SQLModel入门：https://blog.csdn.net/xnuscd/article/details/144081478
- PostgreSQL教程：https://www.runoob.com/postgresql/postgresql-tutorial.html

# 日志输出
```python
from Log import log
log.print_log(log.LOG_INFO,"Hello World")
```
## print_log
- 第一个参数为日志输出类型，有log.LOG_INFO,log.LOG_WARNING,log.LOG_ERROR
- 第二个参数为日志输出内容

# 数据库
数据库使用PostgreSQL，在database.py文件中需要注意DATABASE_URL的修改，格式在注释中

# 文件结构
```
D:.
│  main.py #主函数
│  README.md
│
├─.log #日志文件夹
│
├─Db #关于数据库
│  ├─Posts #关于帖子的数据库操作
│  │      crud.py #关于帖子的插入，读取，更新，删除操作
│  │      database.py #关于帖子的database
│  │      post.py #关于帖子的sqlmodel
│  │
│  └─Users
├─Log #关于日志
│  │  log.py #新建日志，输出日志
│  │  __init__.py
│  │
│  └─__pycache__
│
├─Management #关于后台管理的api
├─Post #关于帖子的api
│      postapi.py
│
└─__pycache__
```