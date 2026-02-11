"""
生成测试用户和帖子的脚本
"""
import sys
import os

from sqlmodel import Session, select
from app.db.database import engine
from app.models.user import User
from app.models.post import Post
from app.core.security import get_password_hash
from datetime import datetime, timedelta
import random

# 测试用户数据
test_users = [
    {"email": "zhangsan@example.com", "username": "张三", "password": "password123"},
    {"email": "lisi@example.com", "username": "李四", "password": "password123"},
    {"email": "wangwu@example.com", "username": "王五", "password": "password123"},
    {"email": "zhaoliu@example.com", "username": "赵六", "password": "password123"},
    {"email": "sunqi@example.com", "username": "孙七", "password": "password123"},
    {"email": "admin@example.com", "username": "管理员", "password": "admin123", "is_superuser": True},
]

# 测试帖子数据
test_posts = [
    {
        "title": "欢迎来到Amine Web社区！",
        "content": "这是一个全新的社交平台，欢迎大家在这里分享生活、交流想法！",
        "summary": "欢迎新用户",
        "category": "公告",
        "tags": ["欢迎", "公告", "社区"],
        "is_published": True,
    },
    {
        "title": "今天天气真不错",
        "content": "阳光明媚，微风徐徐，适合出去走走。大家有什么周末计划吗？",
        "summary": "分享今日好天气",
        "category": "生活",
        "tags": ["天气", "周末", "生活"],
        "is_published": True,
    },
    {
        "title": "推荐一本好书：《百年孤独》",
        "content": "最近读完了《百年孤独》，被马尔克斯的魔幻现实主义深深吸引。这本书讲述了布恩迪亚家族七代人的传奇故事...",
        "summary": "读书分享",
        "category": "阅读",
        "tags": ["读书", "文学", "推荐"],
        "is_published": True,
    },
    {
        "title": "学习FastAPI心得",
        "content": "FastAPI是一个现代化的Python Web框架，性能优秀，文档清晰。今天分享一下我的学习心得...",
        "summary": "FastAPI学习笔记",
        "category": "技术",
        "tags": ["编程", "Python", "FastAPI"],
        "is_published": True,
    },
    {
        "title": "周末爬山记",
        "content": "周末和朋友们去爬山，风景真美！虽然很累，但是很值得。站在山顶俯瞰整个城市的感觉太棒了！",
        "summary": "户外活动分享",
        "category": "旅行",
        "tags": ["爬山", "户外", "旅行"],
        "is_published": True,
    },
    {
        "title": "美食推荐：家常红烧肉",
        "content": "今天做了红烧肉，色泽红亮，肥而不腻。分享一下做法：五花肉切块，焯水去血沫，炒糖色...",
        "summary": "红烧肉做法",
        "category": "美食",
        "tags": ["美食", "烹饪", "家常菜"],
        "is_published": True,
    },
    {
        "title": "电影推荐：《肖申克的救赎》",
        "content": "这部电影讲述了关于希望和自由的故事，每次看都会有新的感悟。强烈推荐！",
        "summary": "经典电影推荐",
        "category": "娱乐",
        "tags": ["电影", "推荐", "经典"],
        "is_published": True,
    },
    {
        "title": "健身打卡第30天",
        "content": "坚持健身一个月了，感觉身体状态越来越好。分享一下我的健身计划和心得...",
        "summary": "健身分享",
        "category": "健康",
        "tags": ["健身", "运动", "健康"],
        "is_published": True,
    },
    {
        "title": "摄影技巧：如何拍出好看的日落",
        "content": "日落是摄影中最美的主题之一。今天分享几个拍摄日落的技巧：黄金时刻、构图法则...",
        "summary": "摄影教程",
        "category": "摄影",
        "tags": ["摄影", "技巧", "教程"],
        "is_published": True,
    },
    {
        "title": "草稿：待完成的想法",
        "content": "这是一个还没写完的帖子，暂时保存为草稿。",
        "summary": "草稿内容",
        "category": "其他",
        "tags": ["草稿"],
        "is_published": False,
    },
]


def create_test_data():
    """生成测试数据"""
    with Session(engine) as session:
        # 检查现有数据
        existing_user_count = len(session.exec(select(User)).all())
        existing_post_count = len(session.exec(select(Post)).all())
        
        if existing_user_count > 0 or existing_post_count > 0:
            print(f"⚠️  数据库中已有数据:")
            print(f"   - 用户数: {existing_user_count}")
            print(f"   - 帖子数: {existing_post_count}")
            print("\n如需重新生成测试数据，请先运行: python actions/reset_db.py")
            return
        
        print("📝 开始生成测试数据...")
        
        # 创建测试用户
        created_users = []
        print("\n👤 创建测试用户...")
        for user_data in test_users:
            try:
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    hashed_password=get_password_hash(user_data["password"]),
                    is_active=True,
                    is_superuser=user_data.get("is_superuser", False),
                )
                session.add(user)
                session.flush()  # 立即刷新到数据库，但不提交事务
                created_users.append(user)
                role = "管理员" if user.is_superuser else "用户"
                print(f"  ✓ {user.username} ({user.email}) [ID: {user.id}] - {role}")
            except Exception as e:
                print(f"  ❌ 创建用户 {user_data['username']} 失败: {e}")
                session.rollback()
                import traceback
                traceback.print_exc()
                return
        
        print("\n💾 提交用户数据...")
        session.commit()
        print(f"  ✓ 已成功提交 {len(created_users)} 个用户")
        
        # 创建测试帖子
        print("\n📄 创建测试帖子...")
        created_posts = []
        base_time = datetime.utcnow() - timedelta(days=10)
        
        for i, post_data in enumerate(test_posts):
            try:
                # 随机分配作者，但第一篇由管理员发布
                if i == 0:
                    author = created_users[-1]  # 管理员
                else:
                    author = random.choice(created_users[:-1])  # 普通用户
                
                # 设置不同的发布时间
                post_time = base_time + timedelta(days=i, hours=random.randint(0, 23))
                
                post = Post(
                    title=post_data["title"],
                    content=post_data["content"],
                    summary=post_data["summary"],
                    category=post_data["category"],
                    tags=post_data["tags"],
                    is_published=post_data["is_published"],
                    author_id=author.id,
                    created_at=post_time,
                    updated_at=post_time,
                )
                session.add(post)
                created_posts.append(post)
                status = "✓ 已发布" if post.is_published else "📝 草稿"
                print(f"  {status} 《{post.title}》 - 作者: {author.username}")
            except Exception as e:
                print(f"  ❌ 创建帖子 《{post_data['title']}》 失败: {e}")
                raise
        
        print("\n💾 提交帖子数据...")
        session.commit()
        print(f"  ✓ 已提交 {len(created_posts)} 个帖子")
        
        print("\n✅ 测试数据生成完成！")
        print(f"\n📊 统计:")
        print(f"  • 用户数: {len(created_users)}")
        print(f"  • 帖子数: {len(created_posts)}")
        print(f"  • 已发布: {sum(1 for p in created_posts if p.is_published)}")
        print(f"  • 草稿: {sum(1 for p in created_posts if not p.is_published)}")
        
        print("\n🔑 测试账号:")
        print("  普通用户:")
        for user_data in test_users[:-1]:
            print(f"    用户名: {user_data['username']}, 密码: {user_data['password']}")
        print("  管理员:")
        admin = test_users[-1]
        print(f"    用户名: {admin['username']}, 密码: {admin['password']}")


if __name__ == "__main__":
    try:
        create_test_data()
    except Exception as e:
        print(f"\n❌ 生成测试数据失败: {e}")
        import traceback
        traceback.print_exc()
