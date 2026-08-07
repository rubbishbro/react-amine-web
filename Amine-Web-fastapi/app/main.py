# 入口文件

import logging
import logging.config
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles # 静态资源托管
from fastapi.middleware.cors import CORSMiddleware # 前后端跨域
from starlette.middleware.trustedhost import TrustedHostMiddleware
import uvicorn # 运行服务器

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings # 配置中心，管理项目名，API前缀，CORS白名单，数据库
from app.core.limiter import limiter  # 全局速率限制器
from app.core.request_limits import SecurityRateLimitMiddleware, create_redis_client
from app.api.api import api_router # 路由注册（入口）
from app.db.database import init_db # 初始化数据库
from app import models  # noqa: F401 - 导入模型以注册 SQLModel 元数据
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
app.add_middleware(SecurityRateLimitMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

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


@app.middleware("http")
async def add_security_headers(request, call_next):
    request_id = request.headers.get("x-request-id") or uuid4().hex
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled request error request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        response = JSONResponse(
            status_code=500,
            content={
                "detail": "The server could not process the request",
                "request_id": request_id,
            },
        )

        # This middleware is outside CORSMiddleware. Add the exact approved
        # origin on locally generated 500 responses so browsers expose the
        # JSON error instead of reducing it to an opaque `Failed to fetch`.
        origin = request.headers.get("origin")
        allowed_origins = {str(item) for item in settings.BACKEND_CORS_ORIGINS}
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    if _is_production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response

# 启动事件，初始化数据库
@app.on_event("startup")
async def on_startup():
    if _is_production and not settings.REDIS_URL:
        raise RuntimeError("REDIS_URL is required in production")
    app.state.security_redis = await create_redis_client()
    init_db()
    env = settings.ENVIRONMENT
    logger.info("Amine Web API 已启动 [%s] Swagger=%s", env, "off" if _is_production else "on")


@app.on_event("shutdown")
async def on_shutdown():
    redis_client = getattr(app.state, "security_redis", None)
    if redis_client is not None:
        await redis_client.aclose()

# 根路由
@app.get("/")
def root():
    return {"message": "Welcome to Amine Web API"}

# 生产环境请使用uvicorn app.main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
