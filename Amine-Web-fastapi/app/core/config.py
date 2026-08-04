# 核心配置文件
from typing import List, Optional, Union  # typing导入List和Union
from pydantic import AnyHttpUrl, EmailStr, field_validator # 导入Pydantic的AnyHttpUrl和field_validator 
from pydantic_settings import BaseSettings, SettingsConfigDict # 导入BaseSettings和SettingsConfigDict

# 自动读取环境变量配置
class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Amine Web API"
    
    # CORS 白名单
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://lnssy-cykj.online",
        "https://www.lnssy-cykj.online",
    ]

    # 转换列表
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(v)

    # 从env读取，如无，报错
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_PORT: int
    POSTGRES_DB: str
    # 定义数据库连接字符串
    SQLALCHEMY_DATABASE_URI: Union[str, None] = None

    # 组装数据库连接字符串
    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    def assemble_db_connection(cls, v: Union[str, None], info) -> str:
        # 拼接/读取
        if isinstance(v, str):
            return v
        return f"postgresql://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}@{info.data.get('POSTGRES_SERVER')}:{info.data.get('POSTGRES_PORT')}/{info.data.get('POSTGRES_DB')}"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256" # 采用HS256算法
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # 管理员密钥
    ADMIN_SECRET_KEY: str

    # 邮件验证码（注册/重置密码）
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[EmailStr] = None
    SMTP_USE_TLS: bool = True

    EMAIL_CODE_EXPIRE_MINUTES: int = 10
    EMAIL_CODE_SEND_COOLDOWN_SECONDS: int = 60
    EMAIL_CODE_DEBUG: bool = False

    # 七牛云对象存储（可选，未配置时回退到本地存储）
    QINIU_ACCESS_KEY: str = ""
    QINIU_SECRET_KEY: str = ""
    QINIU_BUCKET_NAME: str = ""
    QINIU_DOMAIN: str = ""   # 例: https://xxx.bkt.clouddn.com

    # Redis（可选，用于验证码持久化；不配置则退回内存模式）
    # 生产环境建议配置，多进程/重启后验证码不会丢失
    REDIS_URL: str = ""  # 例: redis://localhost:6379/0

    # 运行环境：development | production
    # 生产环境自动关闭 Swagger 文档
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

# 读取.env配置文件，生成
settings = Settings()
