"""Initial schema for Ontology Hub.

Revision ID: 001
Revises:
Create Date: 2026-01-21

Creates tables:
- entities: Schema entities (categories, properties, subobjects)
- modules: Schema modules grouping categories
- profiles: Module collections for different implementations
- drafts: Draft proposals with capability URL access
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define enum types
entitytype = postgresql.ENUM("category", "property", "subobject", name="entitytype", create_type=False)
draftstatus = postgresql.ENUM("pending", "validated", "submitted", "expired", name="draftstatus", create_type=False)


def upgrade() -> None:
    # Create enum types first
    entitytype.create(op.get_bind(), checkfirst=True)
    draftstatus.create(op.get_bind(), checkfirst=True)

    # Create entities table
    op.create_table(
        "entities",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("entity_type", entitytype, nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("schema_definition", sa.JSON(), nullable=True),
        sa.Column("commit_sha", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_entities_entity_id"), "entities", ["entity_id"])

    # Create modules table
    op.create_table(
        "modules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("module_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category_ids", sa.JSON(), nullable=True),
        sa.Column("dependencies", sa.JSON(), nullable=True),
        sa.Column("commit_sha", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("module_id"),
    )
    op.create_index(op.f("ix_modules_module_id"), "modules", ["module_id"])

    # Create profiles table
    op.create_table(
        "profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("module_ids", sa.JSON(), nullable=True),
        sa.Column("commit_sha", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id"),
    )
    op.create_index(op.f("ix_profiles_profile_id"), "profiles", ["profile_id"])

    # Create drafts table
    op.create_table(
        "drafts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("capability_hash", sa.String(), nullable=False),
        sa.Column("status", draftstatus, nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("source_wiki", sa.String(), nullable=True),
        sa.Column("base_commit_sha", sa.String(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("capability_hash"),
    )
    op.create_index(
        op.f("ix_drafts_capability_hash"), "drafts", ["capability_hash"]
    )


def downgrade() -> None:
    # Drop tables
    op.drop_index(op.f("ix_drafts_capability_hash"), table_name="drafts")
    op.drop_table("drafts")

    op.drop_index(op.f("ix_profiles_profile_id"), table_name="profiles")
    op.drop_table("profiles")

    op.drop_index(op.f("ix_modules_module_id"), table_name="modules")
    op.drop_table("modules")

    op.drop_index(op.f("ix_entities_entity_id"), table_name="entities")
    op.drop_table("entities")

    # Drop enum types
    draftstatus.drop(op.get_bind(), checkfirst=True)
    entitytype.drop(op.get_bind(), checkfirst=True)
