"""Add Dashboard and Resource tables with relationship tables.

Revision ID: 002
Revises: 001
Create Date: 2026-01-28

Creates:
- dashboards: Dashboard entity table with canonical_json for pages
- resources: Resource entity table with category_key string column
- module_dashboard: Junction table linking modules to dashboards
- bundle_dashboard: Junction table linking bundles to dashboards
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "002"
down_revision: str = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # === Entity Tables ===

    # dashboards table
    op.create_table(
        "dashboards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_dashboards_entity_key"),
    )
    op.create_index(op.f("ix_dashboards_entity_key"), "dashboards", ["entity_key"])
    op.create_index(op.f("ix_dashboards_label"), "dashboards", ["label"])

    # resources table
    op.create_table(
        "resources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category_key", sa.String(), nullable=False),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_resources_entity_key"),
    )
    op.create_index(op.f("ix_resources_entity_key"), "resources", ["entity_key"])
    op.create_index(op.f("ix_resources_label"), "resources", ["label"])
    op.create_index(op.f("ix_resources_category_key"), "resources", ["category_key"])

    # === Relationship Tables ===

    # module_dashboard - module references dashboard
    op.create_table(
        "module_dashboard",
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.Column("dashboard_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("module_id", "dashboard_id"),
        sa.ForeignKeyConstraint(["module_id"], ["modules_v2.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="RESTRICT"),
    )

    # bundle_dashboard - bundle references dashboard
    op.create_table(
        "bundle_dashboard",
        sa.Column("bundle_id", sa.UUID(), nullable=False),
        sa.Column("dashboard_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("bundle_id", "dashboard_id"),
        sa.ForeignKeyConstraint(["bundle_id"], ["bundles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="RESTRICT"),
    )


def downgrade() -> None:
    # Drop relationship tables first (FK dependencies)
    op.drop_table("bundle_dashboard")
    op.drop_table("module_dashboard")

    # Drop entity tables
    op.drop_index(op.f("ix_resources_category_key"), table_name="resources")
    op.drop_index(op.f("ix_resources_label"), table_name="resources")
    op.drop_index(op.f("ix_resources_entity_key"), table_name="resources")
    op.drop_table("resources")

    op.drop_index(op.f("ix_dashboards_label"), table_name="dashboards")
    op.drop_index(op.f("ix_dashboards_entity_key"), table_name="dashboards")
    op.drop_table("dashboards")
