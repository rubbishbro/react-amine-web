# 入口文件

import logging
import logging.config

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles # 静态资源托管
from fastapi.middleware.cors import CORSMiddleware # 前后端跨域
import uvicorn # 运行服务器

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings # 配置中心，管理项目名，API前缀，CORS白名单，数据库
from app.core.limiter import limiter  # 全局速率限制器
from app.api.api import api_router # 路由注册（入口）
from app.db.database import init_db # 初始化数据库
from app import models 
# 将models重新执行一遍，否则不会创建表

# 配置结构化日志（先建目录再配置，否则 RotatingFileHandler 找不到路径）
import os
os.makedirs("logs", exist_ok=True)

logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/app.log",
            "maxBytes": 10 * 1024 * 1024,  # 10MB 单文件上限
            "backupCount": 5,             # 保留最近 5 份
            "formatter": "default",
            "encoding": "utf-8",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "file"],
    },
})

logger = logging.getLogger(__name__)

# 生产环境关闭 Swagger 文档，开发环境正常开放
_is_production = settings.ENVIRONMENT.lower() == "production"
_openapi_url = None if _is_production else f"{settings.API_V1_STR}/openapi.json"
_docs_url = None if _is_production else "/docs"
_redoc_url = None if _is_production else "/redoc"

# 创建 FastAPI 实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=_openapi_url,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

# 注册速率限制器
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# 设置所有 CORS 允许的源，告诉浏览器哪些前端合法
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# 静态资源托管(图片/音频上传）
app.mount("/static/uploads", StaticFiles(directory="static/uploads"), name="uploads")

# 注册API路由
app.include_router(api_router, prefix=settings.API_V1_STR)

# 启动事件，初始化数据库
@app.on_event("startup")
def on_startup():
    init_db()
    env = settings.ENVIRONMENT
    logger.info("Amine Web API 已启动 [%s] Swagger=%s", env, "off" if _is_production else "on")

# 根路由
@app.get("/")
def root():
    return {"message": "Welcome to Amine Web API"}

# 生产环境请使用uvicorn app.main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
