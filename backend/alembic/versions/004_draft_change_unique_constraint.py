"""Add unique constraint on (draft_id, entity_type, entity_key) for draft_change.

Prevents duplicate changes for the same entity within a single draft,
which would break the one-change-per-entity-per-draft invariant.

Revision ID: 004
Revises: 003
"""

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_draft_change_draft_entity",
        "draft_change",
        ["draft_id", "entity_type", "entity_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_draft_change_draft_entity", "draft_change", type_="unique")
