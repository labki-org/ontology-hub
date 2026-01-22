"""Add validation_results column to drafts table.

Revision ID: 004
Revises: 003
Create Date: 2026-01-22

Stores validation results (errors, warnings, suggested semver) computed on draft create/update.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add validation_results column as JSON (nullable for existing drafts)
    op.add_column(
        "drafts",
        sa.Column("validation_results", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("drafts", "validation_results")
