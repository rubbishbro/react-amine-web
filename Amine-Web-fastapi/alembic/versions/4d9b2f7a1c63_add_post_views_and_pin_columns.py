"""add post views / pin columns and feed indexes

Revision ID: 4d9b2f7a1c63
Revises: 2c84c6f6d5a1
Create Date: 2026-10-13

背景：`app/models/post.py` 里的 `views / is_pinned / pinned_at` 从来没有对应的迁移，
而 `alembic/versions/9f42c2b69d95_initial_schema.py:64-76` 建 post 表时只建了
id/title/content/summary/category/tags/created_at/updated_at/is_published/author_id。
`init_db()` 只做 `create_all()`，SQLAlchemy 的 create_all 不会给已存在的表补列，
所以用 `alembic upgrade head` 建出来的库一查帖子就会 UndefinedColumn -> 500；
只有走 `actions/reset_db.py` 的 drop_all/create_all 才正常。

另外迁移里 post 表没有任何索引，列表/搜索的排序都是全表扫描。

因为线上的库既可能是 create_all 建的（已有这三列、但没有索引），
也可能是纯迁移建的（既没列也没索引），这里用 inspector 做了幂等处理，
两种情况都能安全执行。

如何应用：
  * 纯迁移建的库：        alembic upgrade head
  * 用 actions/reset_db.py（create_all）建、且从未打过 alembic 标记的库：
        alembic stamp 2c84c6f6d5a1   # 只标记到上一个版本，避免重跑建表
        alembic upgrade head         # 只会补索引（列已存在则跳过）
  注意 SQLModel 的 create_all 对「已存在的表」是整体跳过的，不会补建索引，
  所以索引只能靠这个迁移或手工 SQL 来加。
"""

from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = "4d9b2f7a1c63"
down_revision: Union[str, None] = "2c84c6f6d5a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 与 ORM 对齐：models/post.py 里 Field(default=0/False) 没有 server_default，
# 但给已存在的表加 NOT NULL 列必须给默认值，否则存量行会失败。
POST_COLUMNS = (
    ("views", sa.Column("views", sa.Integer(), nullable=False, server_default=sa.text("0"))),
    ("is_pinned", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("pinned_at", sa.Column("pinned_at", sa.DateTime(), nullable=True)),
)

POST_INDEXES = (
    ("ix_post_created_at", ["created_at"]),
    ("ix_post_author_id", ["author_id"]),
    ("ix_post_category", ["category"]),
)


def _post_columns(inspector) -> set:
    return {column["name"] for column in inspector.get_columns("post")}


def _post_indexes(inspector) -> set:
    return {index["name"] for index in inspector.get_indexes("post")}


def upgrade() -> None:
    if context.is_offline_mode():
        # 离线模式（alembic upgrade --sql）拿不到连接、无法探测现状，
        # 只能无条件生成语句；这种模式下请只对「结构未知/干净」的库使用。
        for _name, column in POST_COLUMNS:
            op.add_column("post", column)
        for name, columns in POST_INDEXES:
            op.create_index(name, "post", columns)
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = _post_columns(inspector)
    for name, column in POST_COLUMNS:
        if name not in existing_columns:
            op.add_column("post", column)

    # 列加完后要重新取索引信息（上面可能改了表结构）
    inspector = sa.inspect(bind)
    existing_indexes = _post_indexes(inspector)
    for name, columns in POST_INDEXES:
        if name not in existing_indexes:
            op.create_index(name, "post", columns)


def downgrade() -> None:
    if context.is_offline_mode():
        for name, _columns in POST_INDEXES:
            op.drop_index(name, table_name="post")
        for name, _column in reversed(POST_COLUMNS):
            op.drop_column("post", name)
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = _post_indexes(inspector)
    for name, _columns in POST_INDEXES:
        if name in existing_indexes:
            op.drop_index(name, table_name="post")

    inspector = sa.inspect(bind)
    existing_columns = _post_columns(inspector)
    for name, _column in reversed(POST_COLUMNS):
        if name in existing_columns:
            op.drop_column("post", name)
