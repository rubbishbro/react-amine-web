from typing import List, Optional
from sqlmodel import Session, select
from app.models.post import Post
from app.schemas.post import PostCreate, PostUpdate

# 按照id获取帖子
def get(db: Session, id: int) -> Optional[Post]:
    from sqlalchemy.orm import selectinload
    
    statement = select(Post).options(selectinload(Post.author)).where(Post.id == id)
    post = db.exec(statement).first()
    return post

# 分页列出帖子

# 前端此处使用了假分页，实际上是一次性获取大量数据，故limit设置较大，后续需要更改前端
def get_multi(db: Session, *, skip: int = 0, limit: int = 1000) -> List[Post]:
    from sqlalchemy.orm import selectinload
    
    # 使用 selectinload 预加载 author，避免 N+1 查询问题
    statement = (
        select(Post)
        .options(selectinload(Post.author))
        .offset(skip)
        .limit(limit)
    )
    posts = db.exec(statement).all()
    return posts

# 创建帖子
def create(db: Session, *, obj_in: PostCreate, author_id: int) -> Post:
    db_obj = Post(**obj_in.model_dump(), author_id=author_id)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

# 删除帖子
def remove(db: Session, *, id: int) -> Optional[Post]:
    obj = db.get(Post, id)
    if obj:
        db.delete(obj)
        db.commit()
    return obj

# 更新帖子
def update(db: Session, *, db_obj: Post, obj_in: PostUpdate) -> Post:
    post_data = obj_in.model_dump(exclude_unset=True)
    for key, value in post_data.items():
        setattr(db_obj, key, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

