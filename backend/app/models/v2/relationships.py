"""Relationship tables for v2.0 entity connections.

These tables normalize many-to-many relationships that were stored as
JSONB arrays in v1.0.
"""

import uuid

from sqlmodel import Field, SQLModel

from app.models.v2.enums import EntityType


class CategoryParent(SQLModel, table=True):
    """Category inheritance relationship.

    Represents: "category X inherits from parent Y"
    A category can have multiple parents (multiple inheritance).
    """

    __tablename__ = "category_parent"

    category_id: uuid.UUID = Field(foreign_key="categories.id", primary_key=True)
    parent_id: uuid.UUID = Field(foreign_key="categories.id", primary_key=True)


class CategoryProperty(SQLModel, table=True):
    """Direct property assignment to a category.

    Only stores DIRECT assignments (not inherited). Inherited properties
    are computed by the category_property_effective materialized view.
    """

    __tablename__ = "category_property"

    category_id: uuid.UUID = Field(foreign_key="categories.id", primary_key=True)
    property_id: uuid.UUID = Field(foreign_key="properties.id", primary_key=True)
    is_required: bool = Field(default=False)


class ModuleEntity(SQLModel, table=True):
    """Module membership for all entity types.

    Tracks which entities belong to which module. Uses entity_key instead
    of FK because the entity could be any of 6 types (category, property,
    subobject, module, bundle, template).
    """

    __tablename__ = "module_entity"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    module_id: uuid.UUID = Field(foreign_key="modules.id", index=True)
    entity_type: EntityType
    entity_key: str = Field(index=True)


class BundleModule(SQLModel, table=True):
    """Bundle-to-module composition.

    Represents: "bundle X includes module Y"
    A bundle can include multiple modules.
    """

    __tablename__ = "bundle_module"

    bundle_id: uuid.UUID = Field(foreign_key="bundles.id", primary_key=True)
    module_id: uuid.UUID = Field(foreign_key="modules.id", primary_key=True)
