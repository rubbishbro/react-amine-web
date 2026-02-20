"""initial_schema

Revision ID: 9f42c2b69d95
Revises: 
Create Date: 2026-02-20 10:01:18.541794

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision: str = '9f42c2b69d95'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 枚举类型
interactiontype = sa.Enum('like', 'comment', 'favorite', name='interactiontype')
relationtype = sa.Enum('follow', 'block', 'mute', name='relationtype')


def upgrade() -> None:
    # 创建枚举类型
    interactiontype.create(op.get_bind(), checkfirst=True)
    relationtype.create(op.get_bind(), checkfirst=True)

    # 1. user 表（无外键依赖）
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

    # 2. post 表（依赖 user）
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

    # 3. interaction 表（依赖 user, post）
    op.create_table(
        'interaction',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('type', sa.Enum('like', 'comment', 'favorite', name='interactiontype', create_type=False), nullable=False),
        sa.Column('content', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('post.id'), nullable=True),
    )

    # 4. comment 表（依赖 post, user, comment 自引用）
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

    # 5. comment_like 表（依赖 comment, user）
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

    # 6. user_relation 表（依赖 user）
    op.create_table(
        'user_relation',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('from_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('to_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('relation_type', sa.Enum('follow', 'block', 'mute', name='relationtype', create_type=False), nullable=False),
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
    relationtype.drop(op.get_bind(), checkfirst=True)
    interactiontype.drop(op.get_bind(), checkfirst=True)
