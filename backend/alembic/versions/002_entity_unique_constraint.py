"""Add unique constraint for entity upsert.

Revision ID: 002
Revises: 001
Create Date: 2026-01-21

This constraint enables ON CONFLICT DO UPDATE upserts by (entity_id, entity_type).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add unique constraint on (entity_id, entity_type) for upsert support
    op.create_unique_constraint(
        "uq_entities_entity_id_type",
        "entities",
        ["entity_id", "entity_type"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_entities_entity_id_type", "entities", type_="unique")
