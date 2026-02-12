"""
生成测试用户和帖子的脚本
"""
from sqlmodel import Session, select
from app.db.database import engine
from app.models.user import User
from app.models.post import Post
from app.core.security import get_password_hash
from datetime import datetime, timedelta
import random

# 测试用户数据
test_users = [
    {"email": "zhangsan@example.com", "username": "张三", "password": "password123", "userSchool": "北京大学", "userClass": "计算机科学1班"},
    {"email": "lisi@example.com", "username": "李四", "password": "password123", "userSchool": "清华大学", "userClass": "软件工程2班"},
    {"email": "wangwu@example.com", "username": "王五", "password": "password123", "userSchool": "浙江大学", "userClass": "人工智能3班"},
    {"email": "zhaoliu@example.com", "username": "赵六", "password": "password123", "userSchool": "上海交通大学", "userClass": "数据科学1班"},
    {"email": "sunqi@example.com", "username": "孙七", "password": "password123", "userSchool": "复旦大学", "userClass": "网络工程2班"},
    {"email": "admin@example.com", "username": "管理员", "password": "admin123", "is_superuser": True, "userSchool": "系统管理员", "userClass": "管理员组"},
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
        if session.exec(select(User)).first():
            print("⚠️  数据库已有数据，请先运行: python actions/reset_db.py")
            return
        
        print("📝 生成测试数据...\n")
        
        # 创建用户
        created_users = []
        for user_data in test_users:
            user = User(
                email=user_data["email"],
                username=user_data["username"],
                hashed_password=get_password_hash(user_data["password"]),
                userSchool=user_data.get("userSchool"),
                userClass=user_data.get("userClass"),
                is_active=True,
                is_superuser=user_data.get("is_superuser", False),
            )
            session.add(user)
            session.flush()
            created_users.append(user)
            print(f"  ✓ {user.username}")
        
        # 创建帖子
        base_time = datetime.utcnow() - timedelta(days=10)
        for i, post_data in enumerate(test_posts):
            author = created_users[-1] if i == 0 else random.choice(created_users[:-1])
            post = Post(
                **post_data,
                author_id=author.id,
                created_at=base_time + timedelta(days=i, hours=random.randint(0, 23)),
                updated_at=base_time + timedelta(days=i, hours=random.randint(0, 23)),
            )
            session.add(post)
            print(f"  ✓ 《{post.title}》")
        
        session.commit()
        
        print(f"\n✅ 完成！用户: {len(created_users)}, 帖子: {len(test_posts)}")
        print("\n🔑 测试账号:")
        for user_data in test_users:
            role = "管理员" if user_data.get("is_superuser") else "普通用户"
            print(f"  {role} - {user_data['username']}: {user_data['password']}")


if __name__ == "__main__":
    try:
        create_test_data()
    except Exception as e:
        print(f"\n❌ 失败: {e}")
