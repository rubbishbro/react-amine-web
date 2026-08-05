"""add DM attachment ownership and message binding

Revision ID: 2c84c6f6d5a1
Revises: 9f42c2b69d95
Create Date: 2026-08-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2c84c6f6d5a1"
down_revision: Union[str, None] = "9f42c2b69d95"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dmattachment",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=128), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("receiver_id", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["receiver_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("ix_dmattachment_storage_key", "dmattachment", ["storage_key"])
    op.create_index("ix_dmattachment_owner_id", "dmattachment", ["owner_id"])
    op.create_index("ix_dmattachment_receiver_id", "dmattachment", ["receiver_id"])
    op.create_index("ix_dmattachment_created_at", "dmattachment", ["created_at"])

    op.add_column(
        "directmessage",
        sa.Column("attachment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_directmessage_attachment_id",
        "directmessage",
        "dmattachment",
        ["attachment_id"],
        ["id"],
    )
    op.create_index(
        "ix_directmessage_attachment_id",
        "directmessage",
        ["attachment_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_directmessage_attachment_id", table_name="directmessage")
    op.drop_constraint("fk_directmessage_attachment_id", "directmessage", type_="foreignkey")
    op.drop_column("directmessage", "attachment_id")
    op.drop_index("ix_dmattachment_created_at", table_name="dmattachment")
    op.drop_index("ix_dmattachment_receiver_id", table_name="dmattachment")
    op.drop_index("ix_dmattachment_owner_id", table_name="dmattachment")
    op.drop_index("ix_dmattachment_storage_key", table_name="dmattachment")
    op.drop_table("dmattachment")
