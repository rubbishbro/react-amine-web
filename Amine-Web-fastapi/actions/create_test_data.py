"""
测试搜索功能的脚本
"""
import sys
sys.path.insert(0, 'C:/Users/pc/Desktop/react-amine-web/Amine-Web-fastapi')

from sqlmodel import Session
from app.db.database import engine
from app.models.user import User
from app.models.post import Post
from app.core.security import get_password_hash
from datetime import datetime

def create_test_data():
    """创建测试数据"""
    with Session(engine) as session:
        # 创建测试用户
        users_data = [
            {"username": "anime_lover", "email": "anime@test.com", "password": "password123"},
            {"username": "manga_fan", "email": "manga@test.com", "password": "password123"},
            {"username": "otaku_king", "email": "otaku@test.com", "password": "password123"},
        ]
        
        users = []
        for data in users_data:
            # 检查是否已存在
            existing = session.query(User).filter(User.username == data["username"]).first()
            if not existing:
                user = User(
                    username=data["username"],
                    email=data["email"],
                    hashed_password=get_password_hash(data["password"]),
                    is_superuser=False
                )
                session.add(user)
                users.append(user)
            else:
                users.append(existing)
        
        session.commit()
        
        # 刷新用户ID
        for user in users:
            session.refresh(user)
        
        # 创建测试帖子
        posts_data = [
            {
                "title": "推荐几部优秀的动漫作品",
                "content": "最近看了《进击的巨人》和《鬼灭之刃》，剧情非常精彩，强烈推荐！",
                "category": "动漫推荐",
                "tags": ["动漫", "推荐", "进击的巨人"],
                "author_id": users[0].id
            },
            {
                "title": "漫画收藏分享",
                "content": "我的漫画收藏已经超过100本了，有兴趣的朋友可以来交流。",
                "category": "收藏",
                "tags": ["漫画", "收藏"],
                "author_id": users[1].id
            },
            {
                "title": "动漫社活动通知",
                "content": "下周六将举办动漫主题观影会，欢迎大家参加！地点在学校礼堂。",
                "category": "活动",
                "tags": ["活动", "通知", "观影会"],
                "author_id": users[2].id
            },
            {
                "title": "二次元文化讨论",
                "content": "大家觉得二次元文化在中国的发展如何？欢迎发表看法。",
                "category": "讨论",
                "tags": ["二次元", "讨论", "文化"],
                "author_id": users[0].id
            },
            {
                "title": "最新番剧追番指南",
                "content": "2026年冬季番剧推荐：《进击的巨人最终季》、《咒术回战第三季》等。",
                "category": "番剧",
                "tags": ["番剧", "推荐", "2026"],
                "author_id": users[1].id
            },
        ]
        
        for data in posts_data:
            # 检查是否已存在
            existing = session.query(Post).filter(Post.title == data["title"]).first()
            if not existing:
                post = Post(**data, is_published=True)
                session.add(post)
        
        session.commit()
        print("✅ 测试数据创建成功！")
        
        # 显示统计
        user_count = session.query(User).count()
        post_count = session.query(Post).count()
        print(f"📊 当前数据库状态：")
        print(f"   - 用户数: {user_count}")
        print(f"   - 帖子数: {post_count}")

if __name__ == "__main__":
    create_test_data()
