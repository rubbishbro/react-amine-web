"""
管理员操作 CRUD
"""
from typing import Optional
from datetime import datetime
from sqlmodel import Session
from app.models.user import User


class CRUDAdmin:
    """管理员相关操作"""
    
    def set_title(self, db: Session, *, user_id: int, title: str) -> User:
        """设置用户头衔"""
        user = db.get(User, user_id)
        if not user:
            return None
        user.title = title.strip() if title else None
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def set_role(self, db: Session, *, user_id: int, is_superuser: bool) -> User:
        """设置用户权限"""
        user = db.get(User, user_id)
        if not user:
            return None
        user.is_superuser = is_superuser
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def mute_user(self, db: Session, *, user_id: int, reason: Optional[str] = None) -> User:
        """禁言用户"""
        user = db.get(User, user_id)
        if not user:
            return None
        if user.is_superuser:
            return None  # 不能禁言管理员
        
        user.is_muted = True
        user.mute_count += 1
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def unmute_user(self, db: Session, *, user_id: int) -> User:
        """取消禁言"""
        user = db.get(User, user_id)
        if not user:
            return None
        
        user.is_muted = False
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def ban_user(self, db: Session, *, user_id: int, reason: str) -> User:
        """封禁用户"""
        user = db.get(User, user_id)
        if not user:
            return None
        if user.is_superuser:
            return None  # 不能封禁管理员
        
        user.is_banned = True
        user.ban_count += 1
        user.is_active = False  # 封禁同时停用账户
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def unban_user(self, db: Session, *, user_id: int) -> User:
        """取消封禁"""
        user = db.get(User, user_id)
        if not user:
            return None
        
        user.is_banned = False
        user.is_active = True  # 恢复账户激活状态
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def delete_user(self, db: Session, *, user_id: int) -> bool:
        """删除用户（管理员不能删除其他管理员）"""
        user = db.get(User, user_id)
        if not user:
            return False
        if user.is_superuser:
            return False  # 不能删除管理员
        
        db.delete(user)
        db.commit()
        return True


admin = CRUDAdmin()
