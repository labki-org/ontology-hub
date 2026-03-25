"""Migrate resource category_key (single string) to category_keys (ARRAY).

Resources can belong to multiple categories, matching MediaWiki/SemanticSchemas
behavior where a page can have multiple [[Category:X]] annotations.

Revision ID: 003
Revises: 002
"""

import sqlalchemy as sa

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new JSONB column for category list (JSONB supports @> containment queries)
    from sqlalchemy.dialects.postgresql import JSONB

    op.add_column(
        "resources",
        sa.Column("category_keys", JSONB(), nullable=False, server_default="[]"),
    )

    # Migrate data: copy category_key into category_keys JSON array
    op.execute(
        """UPDATE resources SET category_keys = json_build_array(category_key)
           WHERE category_key IS NOT NULL AND category_key != ''"""
    )

    # Drop old column and index (IF EXISTS for idempotency)
    op.execute("DROP INDEX IF EXISTS ix_resources_category_key")
    op.execute("ALTER TABLE resources DROP COLUMN IF EXISTS category_key")


def downgrade() -> None:
    # Add back single column
    op.add_column(
        "resources",
        sa.Column("category_key", sa.String(), nullable=False, server_default=""),
    )
    op.create_index("ix_resources_category_key", "resources", ["category_key"])

    # Migrate data: take first category from JSON array
    op.execute(
        "UPDATE resources SET category_key = category_keys->>0 WHERE category_keys::text != '[]'"
    )

    # Drop JSON column
    op.drop_column("resources", "category_keys")
