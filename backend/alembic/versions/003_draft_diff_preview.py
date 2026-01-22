"""Add diff_preview column to drafts table.

Revision ID: 003
Revises: 002
Create Date: 2026-01-22

Stores the computed diff preview (draft vs canonical) for retrieval via GET /drafts/{token}/diff.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add diff_preview column as JSON (nullable for existing drafts)
    op.add_column(
        "drafts",
        sa.Column("diff_preview", sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("drafts", "diff_preview")
