from sqlmodel import SQLModel,Field

class Post(SQLModel, table=True):#帖子的数据库model
    pass