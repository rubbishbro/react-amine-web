"""initial_schema

Revision ID: 9f42c2b69d95
Revises: 
Create Date: 2026-02-20 10:01:18.541794

"""
from typing import Sequence, Union
from alembic import op

revision: str = '9f42c2b69d95'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 全部用纯 SQL，完全绕开 SQLAlchemy DDL 事件，避免枚举重复创建问题
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
