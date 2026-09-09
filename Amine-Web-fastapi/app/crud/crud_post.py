from typing import List, Optional
from sqlmodel import Session, select
from sqlalchemy import func
from app.models.post import Post
from app.schemas.post import PostCreate, PostUpdate

# 按照id获取帖子
def get(db: Session, id: int) -> Optional[Post]:
    from sqlalchemy.orm import selectinload
    
    statement = select(Post).options(selectinload(Post.author)).where(Post.id == id)
    post = db.exec(statement).first()
    return post

# 分页列出帖子
def get_multi(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 1000,
    category: Optional[str] = None,
) -> List[Post]:
    from sqlalchemy.orm import selectinload
    
    # 使用 selectinload 预加载 author，避免 N+1 查询问题
    statement = (
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.is_published.is_(True))
    )
    if category:
        statement = statement.where(Post.category == category)
    # 置顶优先，置顶内按置顶时间倒序，其余按发布时间倒序
    statement = statement.order_by(
        Post.is_pinned.desc(),
        Post.pinned_at.desc().nullslast(),
        Post.created_at.desc(),
    ).offset(skip).limit(limit)
    posts = db.exec(statement).all()
    return posts


def count(db: Session, *, category: Optional[str] = None) -> int:
    statement = (
        select(func.count())
        .select_from(Post)
        .where(Post.is_published.is_(True))
    )
    if category:
        statement = statement.where(Post.category == category)
    result = db.exec(statement).one()
    return int(result[0] if isinstance(result, tuple) else result)

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


def _counts_by_post(db: Session, ids) -> dict:
    """返回 {post_id: (likes, favorites, replies)} 聚合（无 schema 变更）。"""
    if not ids:
        return {}

    from app.models.interact import Interaction, InteractionType
    from app.models.comment import Comment

    def _group(statement):
        return {int(row[0]): int(row[1]) for row in db.execute(statement).all()}

    likes = _group(
        select(Interaction.post_id, func.count())
        .where(Interaction.post_id.in_(ids), Interaction.type == InteractionType.LIKE)
        .group_by(Interaction.post_id)
    )
    favorites = _group(
        select(Interaction.post_id, func.count())
        .where(Interaction.post_id.in_(ids), Interaction.type == InteractionType.FAVORITE)
        .group_by(Interaction.post_id)
    )
    replies = _group(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(ids), Comment.is_deleted == False)
        .group_by(Comment.post_id)
    )
    return {
        pid: (likes.get(pid, 0), favorites.get(pid, 0), replies.get(pid, 0))
        for pid in ids
    }


def post_to_public(db: Session, post) -> dict:
    """把 Post ORM 转成带互动统计的字典（响应模型可直接校验）。"""
    if post is None:
        return None
    data = post.model_dump()
    likes, favorites, replies = _counts_by_post(db, [post.id]).get(post.id, (0, 0, 0))
    data["likes"] = likes
    data["favorites"] = favorites
    data["replies"] = replies
    author = getattr(post, "author", None)
    if author is not None:
        from app.schemas.user import UserPublic
        data["author"] = UserPublic.model_validate(author).model_dump()
    else:
        data["author"] = None
    return data


def posts_to_public(db: Session, posts) -> list:
    """批量转字典并附带统计，避免逐条 N+1 聚合。"""
    ids = [p.id for p in posts if p is not None and getattr(p, "id", None) is not None]
    counts = _counts_by_post(db, ids)
    from app.schemas.user import UserPublic

    result = []
    for post in posts:
        data = post.model_dump()
        likes, favorites, replies = counts.get(post.id, (0, 0, 0))
        data["likes"] = likes
        data["favorites"] = favorites
        data["replies"] = replies
        author = getattr(post, "author", None)
        data["author"] = UserPublic.model_validate(author).model_dump() if author else None
        result.append(data)
    return result

