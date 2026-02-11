"""
数据库诊断脚本 - 检查表结构和数据
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import inspect, text
from sqlmodel import select
from app.db.database import engine, Session
from app.models import User, Post

def diagnose():
    """诊断数据库状态"""
    
    print("=" * 60)
    print("数据库诊断")
    print("=" * 60)
    
    # 检查表结构
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n📋 数据库中的表: {tables}")
    
    # 检查 user 表的列
    if 'user' in tables:
        print("\n👤 User 表结构:")
        columns = inspector.get_columns('user')
        for col in columns:
            print(f"  - {col['name']}: {col['type']}")
    
    # 使用 SQLModel 查询
    print("\n🔍 使用 SQLModel 查询 User:")
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print(f"  总记录数: {len(users)}")
        for user in users:
            print(f"  - ID: {user.id}, 用户名: {user.username}, 邮箱: {user.email}")
    
    # 使用 SQL 直接查询
    print("\n🔍 使用原生 SQL 查询 user 表:")
    with Session(engine) as session:
        result = session.execute(text("SELECT * FROM \"user\""))
        rows = result.fetchall()
        columns = result.keys()
        print(f"  列名: {list(columns)}")
        print(f"  总记录数: {len(rows)}")
        for row in rows:
            print(f"  - {dict(zip(columns, row))}")
    
    # 检查 post 表
    print("\n📄 使用 SQLModel 查询 Post:")
    with Session(engine) as session:
        posts = session.exec(select(Post)).all()
        print(f"  总记录数: {len(posts)}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    try:
        diagnose()
    except Exception as e:
        print(f"\n❌ 诊断失败: {e}")
        import traceback
        traceback.print_exc()
