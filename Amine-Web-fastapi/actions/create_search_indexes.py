"""
创建搜索相关索引（可重复运行）
"""
from sqlalchemy import text
from app.db.database import engine

statements = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
    "CREATE INDEX IF NOT EXISTS idx_post_tags_gin ON post USING GIN (tags);",
    "CREATE INDEX IF NOT EXISTS idx_post_title_trgm ON post USING GIN (title gin_trgm_ops);",
    "CREATE INDEX IF NOT EXISTS idx_post_content_trgm ON post USING GIN (content gin_trgm_ops);",
]

with engine.begin() as conn:
    for sql in statements:
        conn.execute(text(sql))

print("✅ 搜索索引创建完成")
