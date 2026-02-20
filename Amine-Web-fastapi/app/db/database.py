from sqlmodel import SQLModel, create_engine, Session # 引入Session和create_engine
from app.core.config import settings

engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_size=10,          # 常驻连接数
    max_overflow=20,       # 升峰期允许额外创建的连接数
    pool_pre_ping=True,    # 每次取连接前先检测是否存活，防止断线调用异常
    pool_recycle=1800,     # 30 分钟回收闲置连接，防止 PostgreSQL 超时主动断开
)

def init_db(): # 自动创建表
    SQLModel.metadata.create_all(engine)

def get_db(): # 数据库会话生成器
    with Session(engine) as session:
        yield session
    # 当收到请求，创建一个新的数据库会话，并在请求结束后关闭会话
