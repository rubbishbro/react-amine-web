"""initial_schema

Revision ID: 9f42c2b69d95
Revises: 
Create Date: 2026-02-20 10:01:18.541794

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = '9f42c2b69d95'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 定义枚举，create_type=False 告知 SQLAlchemy 不要自动创建
# 我们在 upgrade() 里用 raw SQL 手动幂等创建，避免版本兼容性问题
interactiontype = sa.Enum('like', 'comment', 'favorite', name='interactiontype', create_type=False)
relationtype = sa.Enum('follow', 'block', 'mute', name='relationtype', create_type=False)


def upgrade() -> None:
    conn = op.get_bind()

    # 用 DO...EXCEPTION 幂等创建枚举（兼容 PostgreSQL < 12，无需 IF NOT EXISTS）
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE interactiontype AS ENUM ('like', 'comment', 'favorite');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE relationtype AS ENUM ('follow', 'block', 'mute');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # 1. user 表
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('username', sa.String(), nullable=False, unique=True),
        sa.Column('userSchool', sa.String(), nullable=True),
        sa.Column('userClass', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, default=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('is_muted', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_banned', sa.Boolean(), nullable=False, default=False),
        sa.Column('mute_count', sa.Integer(), nullable=False, default=0),
        sa.Column('ban_count', sa.Integer(), nullable=False, default=0),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('cover_url', sa.String(), nullable=True),
        sa.Column('bio', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_user_email', 'user', ['email'])
    op.create_index('ix_user_username', 'user', ['username'])

    # 2. post 表
    op.create_table(
        'post',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('summary', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('tags', ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False, default=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
    )

    # 3. interaction 表（使用 create_type=False 的枚举对象，不触发自动建类型）
    op.create_table(
        'interaction',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('type', interactiontype, nullable=False),
        sa.Column('content', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('post.id'), nullable=True),
    )

    # 4. comment 表
    op.create_table(
        'comment',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('content', sa.String(length=2000), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('post.id'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('comment.id'), nullable=True),
        sa.Column('likes', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )
    op.create_index('ix_comment_post_id', 'comment', ['post_id'])
    op.create_index('ix_comment_author_id', 'comment', ['author_id'])
    op.create_index('ix_comment_parent_id', 'comment', ['parent_id'])

    # 5. comment_like 表
    op.create_table(
        'comment_like',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('comment.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('comment_id', 'user_id', name='unique_comment_like'),
    )
    op.create_index('ix_comment_like_comment_id', 'comment_like', ['comment_id'])
    op.create_index('ix_comment_like_user_id', 'comment_like', ['user_id'])

    # 6. user_relation 表（使用 create_type=False 的枚举对象）
    op.create_table(
        'user_relation',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('from_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('to_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('relation_type', relationtype, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('from_user_id', 'to_user_id', 'relation_type', name='unique_user_relation'),
    )
    op.create_index('ix_user_relation_from_user_id', 'user_relation', ['from_user_id'])
    op.create_index('ix_user_relation_to_user_id', 'user_relation', ['to_user_id'])
    op.create_index('ix_user_relation_relation_type', 'user_relation', ['relation_type'])


def downgrade() -> None:
    op.drop_table('user_relation')
    op.drop_table('comment_like')
    op.drop_table('comment')
    op.drop_table('interaction')
    op.drop_table('post')
    op.drop_table('user')
    op.execute(sa.text('DROP TYPE IF EXISTS relationtype;'))
    op.execute(sa.text('DROP TYPE IF EXISTS interactiontype;'))
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE interactiontype AS ENUM ('like', 'comment', 'favorite');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE relationtype AS ENUM ('follow', 'block', 'mute');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "user" (
            id SERIAL PRIMARY KEY,
            email VARCHAR NOT NULL UNIQUE,
            username VARCHAR NOT NULL UNIQUE,
            "userSchool" VARCHAR,
            "userClass" VARCHAR,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
            hashed_password VARCHAR NOT NULL,
            title VARCHAR,
            is_muted BOOLEAN NOT NULL DEFAULT FALSE,
            is_banned BOOLEAN NOT NULL DEFAULT FALSE,
            mute_count INTEGER NOT NULL DEFAULT 0,
            ban_count INTEGER NOT NULL DEFAULT 0,
            avatar_url VARCHAR,
            cover_url VARCHAR,
            bio VARCHAR,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        );
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_username ON "user" (username);')
    op.execute("""
        CREATE TABLE IF NOT EXISTS post (
            id SERIAL PRIMARY KEY,
            title VARCHAR NOT NULL,
            content VARCHAR NOT NULL,
            summary VARCHAR,
            category VARCHAR,
            tags VARCHAR[],
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            is_published BOOLEAN NOT NULL DEFAULT FALSE,
            author_id INTEGER REFERENCES "user"(id)
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS interaction (
            id SERIAL PRIMARY KEY,
            type interactiontype NOT NULL,
            content VARCHAR,
            created_at TIMESTAMP NOT NULL,
            user_id INTEGER REFERENCES "user"(id),
            post_id INTEGER REFERENCES post(id)
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS comment (
            id SERIAL PRIMARY KEY,
            content VARCHAR(2000) NOT NULL,
            post_id INTEGER NOT NULL REFERENCES post(id),
            author_id INTEGER NOT NULL REFERENCES "user"(id),
            parent_id INTEGER REFERENCES comment(id),
            likes INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_comment_post_id ON comment (post_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_comment_author_id ON comment (author_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_comment_parent_id ON comment (parent_id);')
    op.execute("""
        CREATE TABLE IF NOT EXISTS comment_like (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL REFERENCES comment(id),
            user_id INTEGER NOT NULL REFERENCES "user"(id),
            created_at TIMESTAMP NOT NULL,
            CONSTRAINT unique_comment_like UNIQUE (comment_id, user_id)
        );
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_comment_like_comment_id ON comment_like (comment_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_comment_like_user_id ON comment_like (user_id);')
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_relation (
            id SERIAL PRIMARY KEY,
            from_user_id INTEGER NOT NULL REFERENCES "user"(id),
            to_user_id INTEGER NOT NULL REFERENCES "user"(id),
            relation_type relationtype NOT NULL,
            created_at TIMESTAMP NOT NULL,
            CONSTRAINT unique_user_relation UNIQUE (from_user_id, to_user_id, relation_type)
        );
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_relation_from_user_id ON user_relation (from_user_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_relation_to_user_id ON user_relation (to_user_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_relation_relation_type ON user_relation (relation_type);')


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS user_relation;')
    op.execute('DROP TABLE IF EXISTS comment_like;')
    op.execute('DROP TABLE IF EXISTS comment;')
    op.execute('DROP TABLE IF EXISTS interaction;')
    op.execute('DROP TABLE IF EXISTS post;')
    op.execute('DROP TABLE IF EXISTS "user";')
    op.execute('DROP TYPE IF EXISTS relationtype;')
    op.execute('DROP TYPE IF EXISTS interactiontype;')
