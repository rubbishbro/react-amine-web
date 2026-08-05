import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

"""
清空并重建数据库表
警告：会删除所有数据！

安全守卫：生产环境默认禁止执行，除非显式设置环境变量 ALLOW_DB_RESET=1
"""
from app.core.config import settings
from app.db.database import engine, init_db
from sqlmodel import SQLModel
from app.models import User, Post, Interaction, UserRelation, Comment, CommentLike
from app.models.user import User
from sqlalchemy import text

if settings.ENVIRONMENT.lower() == "production" and os.environ.get("ALLOW_DB_RESET") != "1":
    print("❌ 检测到生产环境，拒绝执行数据库重置！")
    print("   如确实需要重置，请显式设置环境变量 ALLOW_DB_RESET=1 后重试。")
    sys.exit(1)

print("⚠️⚠️⚠️⚠️⚠️  警告：即将删除所有数据并重建表结构！⚠️⚠️⚠️⚠️⚠️")
confirm = input("确认继续？输入 YES 继续：")

if confirm == "YES":
    print("正在删除所有表...")
    SQLModel.metadata.drop_all(engine)
    print("正在重新创建表...")
    SQLModel.metadata.create_all(engine)
    # 确保 user 表包含 userSchool 和 userClass 字段
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "userSchool" VARCHAR'))
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "userClass" VARCHAR'))
    print("数据库已重置。")
    # 在重置后重新初始化数据库表
    init_db()
else:
    print("已取消操作。")
