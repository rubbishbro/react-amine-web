# 入口文件

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles # 静态资源托管
from fastapi.middleware.cors import CORSMiddleware # 前后端跨域
import uvicorn # 运行服务器

from app.core.config import settings # 配置中心，管理项目名，API前缀，CORS白名单，数据库
from app.api.api import api_router # 路由注册（入口）
from app.db.database import init_db # 初始化数据库
from app import models 
# 将models重新执行一遍，否则不会创建表

# 创建 FastAPI 实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 设置所有 CORS 允许的源，告诉浏览器哪些前端合法
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True, # 允许携带cookie和authorization头
    allow_methods=["*"], # 允许所有方法（GET, POST, PUT, DELETE, OPTIONS 等）
    allow_headers=["*"], # 允许所有请求头
    expose_headers=["*"], # 暴露所有响应头给前端
)

# 静态资源托管(图片/音频上传）
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册API路由
app.include_router(api_router, prefix=settings.API_V1_STR)

# 启动事件，初始化数据库
@app.on_event("startup")
def on_startup():
    init_db()

# 根路由
@app.get("/")
def root():
    return {"message": "Welcome to Amine Web API"}

# 生产环境请使用uvicorn app.main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
