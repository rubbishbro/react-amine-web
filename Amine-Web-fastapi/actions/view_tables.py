"""
查看数据库表和数据的脚本
"""
from sqlalchemy import inspect, text
from app.db.database import engine, Session


def list_tables():
    """列出所有表"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("\n" + "="*50)
    print("数据库中的表:")
    print("="*50)
    for i, table in enumerate(tables, 1):
        print(f"{i}. {table}")
    print("="*50 + "\n")
    
    return tables


def view_table_data(table_name, limit=100):
    """查看指定表的数据"""
    try:
        with Session(engine) as session:
            # 使用双引号避免 PostgreSQL 保留字问题
            query = text(f'SELECT * FROM "{table_name}" LIMIT {limit}')
            result = session.execute(query)
            rows = result.fetchall()
            columns = list(result.keys())
            
            print(f"\n{'='*80}")
            print(f"表 '{table_name}' 的数据 (最多 {limit} 条):")
            print(f"{'='*80}")
            print(f"总记录数: {len(rows)}")
            
            if rows:
                # 打印列名
                col_header = " | ".join(str(col).ljust(15)[:15] for col in columns)
                print(f"\n{col_header}")
                print("-" * len(col_header))
                
                # 打印数据
                for row in rows:
                    row_str = " | ".join(str(value).ljust(15)[:15] if value is not None else "NULL".ljust(15) for value in row)
                    print(row_str)
            else:
                print("\n该表没有数据")
            
            print(f"{'='*80}\n")
            
    except Exception as e:
        print(f"❌ 查询表 '{table_name}' 时出错: {e}\n")


def view_all_tables():
    """查看所有表的数据"""
    tables = list_tables()
    
    for table in tables:
        view_table_data(table)


def main():
    print("\n🔍 数据库表查看工具")
    
    # 列出所有表
    tables = list_tables()
    
    if not tables:
        print("⚠️  数据库中没有表")
        return
    
    # 用户输入
    print("请输入要查看的表名（直接回车查看所有表）:")
    user_input = input(">>> ").strip()
    
    if user_input:
        if user_input in tables:
            view_table_data(user_input)
        else:
            print(f"\n❌ 表 '{user_input}' 不存在")
            print(f"可用的表: {', '.join(tables)}")
    else:
        print("\n📊 查看所有表的数据...\n")
        view_all_tables()


if __name__ == "__main__":
    main()
