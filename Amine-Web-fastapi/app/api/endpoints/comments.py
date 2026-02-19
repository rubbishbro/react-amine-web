"""
评论 API 端点
"""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api import deps
from app.crud import crud_comment
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.schemas.comment import (
    Comment as CommentSchema,
    CommentCreate,
    CommentUpdate,
    CommentWithAuthor
)

router = APIRouter()

@router.post("/", response_model=CommentSchema)
def create_comment(
    *,
    db: Session = Depends(deps.get_db),
    comment_in: CommentCreate,
    current_user: User = Depends(deps.check_not_muted),
) -> Any:
    """
    创建评论
    """
    # 验证帖子是否存在
    post = db.get(Post, comment_in.post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    # 如果是回复评论，验证父评论是否存在
    if comment_in.parent_id:
        parent_comment = db.get(Comment, comment_in.parent_id)
        if not parent_comment:
            raise HTTPException(status_code=404, detail="父评论不存在")
        if parent_comment.post_id != comment_in.post_id:
            raise HTTPException(status_code=400, detail="父评论不属于该帖子")
    
    comment = crud_comment.create(db, obj_in=comment_in, author_id=current_user.id)
    return comment

@router.get("/post/{post_id}", response_model=List[CommentWithAuthor])
def get_post_comments(
    post_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    获取帖子的评论列表（包含作者信息）
    """
    # 验证帖子是否存在
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    comments = crud_comment.get_by_post(db, post_id=post_id, skip=skip, limit=limit)
    
    # 附加作者信息（避免误用email作为头像）
    # 使用 ORM 预加载的 author 对象
    result = []
    for comment in comments:
        author = comment.author
        result.append({
            **comment.dict(),
            "author_name": author.username if author else "匿名",
            # 如果 author 不存在，使用默认头像或 None
            "author_avatar": None, 
        })
    
    return result

@router.get("/{comment_id}/replies", response_model=List[CommentWithAuthor])
def get_comment_replies(
    comment_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    获取评论的回复列表
    """
    replies = crud_comment.get_replies(db, parent_id=comment_id, skip=skip, limit=limit)
    
    # 附加作者信息
    result = []
    for comment in replies:
        author = db.get(User, comment.author_id)
        result.append({
            **comment.dict(),
            "author_name": author.username if author else "匿名",
            "author_avatar": None,
        })
    
    return result

@router.put("/{comment_id}", response_model=CommentSchema)
def update_comment(
    *,
    comment_id: int,
    db: Session = Depends(deps.get_db),
    comment_in: CommentUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    更新评论内容（仅作者本人）
    """
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改他人的评论")
    
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="评论已删除，无法修改")
    
    comment = crud_comment.update(db, db_obj=comment, obj_in=comment_in)
    return comment

@router.delete("/{comment_id}")
def delete_comment(
    *,
    comment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    删除评论（软删除，仅作者本人或管理员）
    """
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 检查权限：作者本人或管理员
    if comment.author_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="无权删除他人的评论")
    
    success = crud_comment.delete(db, comment_id=comment_id)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")
    
    return {"message": "评论已删除"}

@router.post("/{comment_id}/like")
def like_comment(
    comment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    切换评论点赞状态（已点赞则取消，未点赞则添加）
    """
    comment, liked = crud_comment.toggle_like(db, comment_id=comment_id, user_id=current_user.id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    return {"success": True, "likes": comment.likes, "liked": liked}

@router.get("/post/{post_id}/count")
def get_comment_count(
    post_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    获取帖子的评论总数
    """
    count = crud_comment.get_comment_count(db, post_id=post_id)
    return {"count": count}
