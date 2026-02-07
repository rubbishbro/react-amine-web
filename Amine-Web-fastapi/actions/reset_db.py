"""
清空并重建数据库表
警告：会删除所有数据！
"""
from app.db.database import engine
from sqlmodel import SQLModel
from app.models import User, Post, Interaction

print("⚠️  警告：即将删除所有数据并重建表结构！")
confirm = input("确认继续？输入 YES 继续：")

if confirm == "YES":
    print("正在删除所有表...")
    SQLModel.metadata.drop_all(engine)
    print("正在重新创建表...")
    SQLModel.metadata.create_all(engine)
    print("✅ 完成！数据库已重置。")
else:
    print("已取消操作。")
