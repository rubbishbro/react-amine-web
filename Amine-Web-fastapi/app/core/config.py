# 核心配置文件
from typing import List, Union  # typing导入List和Union
from pydantic import AnyHttpUrl, EmailStr, field_validator # 导入Pydantic的AnyHttpUrl和field_validator 
from pydantic_settings import BaseSettings, SettingsConfigDict # 导入BaseSettings和SettingsConfigDict

# 自动读取环境变量配置
class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Amine Web API"
    
    # CORS 测试环境
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # 转换列表
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
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
    def assemble_db_connection(cls, v: Union[str, None], info) -> AnyHttpUrl:
        # 拼接/读取
        if isinstance(v, str):
            return v
        return f"postgresql://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}@{info.data.get('POSTGRES_SERVER')}:{info.data.get('POSTGRES_PORT')}/{info.data.get('POSTGRES_DB')}"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256" # 采用HS256算法
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

# 读取.env配置文件，生成
settings = Settings()
