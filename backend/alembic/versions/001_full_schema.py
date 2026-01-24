"""Full schema for Ontology Hub v1.0 and v2.0.

Revision ID: 001
Revises:
Create Date: 2026-01-24

Creates all tables for both v1.0 and v2.0 schemas:

v1.0 (legacy):
- entities: Schema entities (categories, properties, subobjects)
- modules: Schema modules grouping categories
- profiles: Module collections for different implementations
- drafts: Draft proposals with capability URL access

v2.0:
- ontology_version: Current canonical state tracking
- Entity tables: categories, properties, subobjects, modules_v2, bundles, templates
- Relationship tables: category_parent, category_property, module_entity, bundle_module
- Materialized view: category_property_effective
- Draft tables: draft, draft_change
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

# v1.0 enum types
entitytype = postgresql.ENUM(
    "category", "property", "subobject",
    name="entitytype",
    create_type=False
)
draftstatus = postgresql.ENUM(
    "pending", "validated", "submitted", "expired",
    name="draftstatus",
    create_type=False
)

# v2.0 enum types
ingeststatus = postgresql.ENUM(
    "pending", "in_progress", "completed", "failed",
    name="ingeststatus",
    create_type=False
)
draftstatus_v2 = postgresql.ENUM(
    "draft", "validated", "submitted", "merged", "rejected",
    name="draftstatus_v2",
    create_type=False
)
changetype = postgresql.ENUM(
    "create", "update", "delete",
    name="changetype",
    create_type=False
)
draftsource = postgresql.ENUM(
    "hub_ui", "mediawiki_push",
    name="draftsource",
    create_type=False
)

# Materialized view SQL
CATEGORY_PROPERTY_EFFECTIVE_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS category_property_effective AS
WITH RECURSIVE inheritance_chain AS (
    -- Base case: direct parents
    SELECT
        cp.category_id,
        cp.parent_id,
        1 as depth,
        ARRAY[cp.parent_id] as path
    FROM category_parent cp

    UNION ALL

    -- Recursive case: grandparents and beyond
    SELECT
        ic.category_id,
        cp.parent_id,
        ic.depth + 1,
        ic.path || cp.parent_id
    FROM inheritance_chain ic
    JOIN category_parent cp ON cp.category_id = ic.parent_id
    WHERE NOT cp.parent_id = ANY(ic.path)  -- Prevent cycles
),
all_properties AS (
    -- Direct properties (depth = 0)
    SELECT
        cp.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        0 as depth,
        cp.is_required
    FROM category_property cp

    UNION ALL

    -- Inherited properties
    SELECT
        ic.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        ic.depth,
        cp.is_required
    FROM inheritance_chain ic
    JOIN category_property cp ON cp.category_id = ic.parent_id
)
SELECT DISTINCT ON (category_id, property_id)
    category_id,
    property_id,
    source_category_id,
    depth,
    is_required
FROM all_properties
ORDER BY category_id, property_id, depth;
"""


def upgrade() -> None:
    # === Create all enum types ===
    entitytype.create(op.get_bind(), checkfirst=True)
    draftstatus.create(op.get_bind(), checkfirst=True)
    ingeststatus.create(op.get_bind(), checkfirst=True)
    draftstatus_v2.create(op.get_bind(), checkfirst=True)
    changetype.create(op.get_bind(), checkfirst=True)
    draftsource.create(op.get_bind(), checkfirst=True)

    # === v1.0 Tables ===

    # entities table
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
        sa.UniqueConstraint("entity_id", "entity_type", name="uq_entities_entity_id_type"),
    )
    op.create_index(op.f("ix_entities_entity_id"), "entities", ["entity_id"])

    # modules table (v1.0)
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

    # profiles table
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

    # drafts table (v1.0)
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
        sa.Column("diff_preview", sa.JSON(), nullable=True),
        sa.Column("validation_results", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("capability_hash"),
    )
    op.create_index(op.f("ix_drafts_capability_hash"), "drafts", ["capability_hash"])

    # === v2.0 Tables ===

    # ontology_version table
    op.create_table(
        "ontology_version",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("commit_sha", sa.String(), nullable=False),
        sa.Column("ingest_status", ingeststatus, nullable=False),
        sa.Column("entity_counts", sa.JSON(), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("errors", sa.JSON(), nullable=True),
        sa.Column("ingested_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ontology_version_commit_sha"),
        "ontology_version",
        ["commit_sha"]
    )

    # categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_categories_entity_key"),
    )
    op.create_index(op.f("ix_categories_entity_key"), "categories", ["entity_key"])
    op.create_index(op.f("ix_categories_label"), "categories", ["label"])

    # properties table
    op.create_table(
        "properties",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_properties_entity_key"),
    )
    op.create_index(op.f("ix_properties_entity_key"), "properties", ["entity_key"])
    op.create_index(op.f("ix_properties_label"), "properties", ["label"])

    # subobjects table
    op.create_table(
        "subobjects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_subobjects_entity_key"),
    )
    op.create_index(op.f("ix_subobjects_entity_key"), "subobjects", ["entity_key"])
    op.create_index(op.f("ix_subobjects_label"), "subobjects", ["label"])

    # modules_v2 table
    op.create_table(
        "modules_v2",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("version", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_modules_v2_entity_key"),
    )
    op.create_index(op.f("ix_modules_v2_entity_key"), "modules_v2", ["entity_key"])
    op.create_index(op.f("ix_modules_v2_label"), "modules_v2", ["label"])

    # bundles table
    op.create_table(
        "bundles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("version", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_bundles_entity_key"),
    )
    op.create_index(op.f("ix_bundles_entity_key"), "bundles", ["entity_key"])
    op.create_index(op.f("ix_bundles_label"), "bundles", ["label"])

    # templates table
    op.create_table(
        "templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("wikitext", sa.Text(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_templates_entity_key"),
    )
    op.create_index(op.f("ix_templates_entity_key"), "templates", ["entity_key"])
    op.create_index(op.f("ix_templates_label"), "templates", ["label"])

    # === Relationship Tables ===

    # category_parent
    op.create_table(
        "category_parent",
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("category_id", "parent_id"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"]),
    )

    # category_property
    op.create_table(
        "category_property",
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("category_id", "property_id"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"]),
    )

    # module_entity
    op.create_table(
        "module_entity",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["module_id"], ["modules_v2.id"]),
    )
    op.create_index(op.f("ix_module_entity_module_id"), "module_entity", ["module_id"])
    op.create_index(op.f("ix_module_entity_entity_key"), "module_entity", ["entity_key"])

    # bundle_module
    op.create_table(
        "bundle_module",
        sa.Column("bundle_id", sa.UUID(), nullable=False),
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("bundle_id", "module_id"),
        sa.ForeignKeyConstraint(["bundle_id"], ["bundles.id"]),
        sa.ForeignKeyConstraint(["module_id"], ["modules_v2.id"]),
    )

    # === Materialized View ===
    op.execute(CATEGORY_PROPERTY_EFFECTIVE_SQL)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cpe_category_property
        ON category_property_effective (category_id, property_id);
    """)

    # === v2.0 Draft Tables ===

    # draft table
    op.create_table(
        "draft",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("capability_hash", sa.String(), nullable=False),
        sa.Column("base_commit_sha", sa.String(), nullable=False),
        sa.Column("status", draftstatus_v2, nullable=False),
        sa.Column("source", draftsource, nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("user_comment", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("validated_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("rebase_status", sa.String(), nullable=True),
        sa.Column("rebase_commit_sha", sa.String(), nullable=True),
        sa.Column("pr_url", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("capability_hash", name="uq_draft_capability_hash"),
    )
    op.create_index(op.f("ix_draft_capability_hash"), "draft", ["capability_hash"])

    # draft_change table
    op.create_table(
        "draft_change",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("draft_id", sa.UUID(), nullable=False),
        sa.Column("change_type", changetype, nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("patch", sa.JSON(), nullable=True),
        sa.Column("replacement_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["draft_id"], ["draft.id"]),
    )
    op.create_index(op.f("ix_draft_change_draft_id"), "draft_change", ["draft_id"])
    op.create_index(op.f("ix_draft_change_entity_key"), "draft_change", ["entity_key"])


def downgrade() -> None:
    # === Drop v2.0 Draft Tables ===
    op.drop_index(op.f("ix_draft_change_entity_key"), table_name="draft_change")
    op.drop_index(op.f("ix_draft_change_draft_id"), table_name="draft_change")
    op.drop_table("draft_change")

    op.drop_index(op.f("ix_draft_capability_hash"), table_name="draft")
    op.drop_table("draft")

    # === Drop Materialized View ===
    op.execute("DROP INDEX IF EXISTS idx_cpe_category_property;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS category_property_effective;")

    # === Drop Relationship Tables ===
    op.drop_table("bundle_module")

    op.drop_index(op.f("ix_module_entity_entity_key"), table_name="module_entity")
    op.drop_index(op.f("ix_module_entity_module_id"), table_name="module_entity")
    op.drop_table("module_entity")

    op.drop_table("category_property")
    op.drop_table("category_parent")

    # === Drop v2.0 Entity Tables ===
    op.drop_index(op.f("ix_templates_label"), table_name="templates")
    op.drop_index(op.f("ix_templates_entity_key"), table_name="templates")
    op.drop_table("templates")

    op.drop_index(op.f("ix_bundles_label"), table_name="bundles")
    op.drop_index(op.f("ix_bundles_entity_key"), table_name="bundles")
    op.drop_table("bundles")

    op.drop_index(op.f("ix_modules_v2_label"), table_name="modules_v2")
    op.drop_index(op.f("ix_modules_v2_entity_key"), table_name="modules_v2")
    op.drop_table("modules_v2")

    op.drop_index(op.f("ix_subobjects_label"), table_name="subobjects")
    op.drop_index(op.f("ix_subobjects_entity_key"), table_name="subobjects")
    op.drop_table("subobjects")

    op.drop_index(op.f("ix_properties_label"), table_name="properties")
    op.drop_index(op.f("ix_properties_entity_key"), table_name="properties")
    op.drop_table("properties")

    op.drop_index(op.f("ix_categories_label"), table_name="categories")
    op.drop_index(op.f("ix_categories_entity_key"), table_name="categories")
    op.drop_table("categories")

    op.drop_index(op.f("ix_ontology_version_commit_sha"), table_name="ontology_version")
    op.drop_table("ontology_version")

    # === Drop v1.0 Tables ===
    op.drop_index(op.f("ix_drafts_capability_hash"), table_name="drafts")
    op.drop_table("drafts")

    op.drop_index(op.f("ix_profiles_profile_id"), table_name="profiles")
    op.drop_table("profiles")

    op.drop_index(op.f("ix_modules_module_id"), table_name="modules")
    op.drop_table("modules")

    op.drop_index(op.f("ix_entities_entity_id"), table_name="entities")
    op.drop_table("entities")

    # === Drop Enum Types ===
    draftsource.drop(op.get_bind(), checkfirst=True)
    changetype.drop(op.get_bind(), checkfirst=True)
    draftstatus_v2.drop(op.get_bind(), checkfirst=True)
    ingeststatus.drop(op.get_bind(), checkfirst=True)
    draftstatus.drop(op.get_bind(), checkfirst=True)
    entitytype.drop(op.get_bind(), checkfirst=True)
