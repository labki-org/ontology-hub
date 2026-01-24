"""v2.0 entity models package.

This module re-exports all v2.0 models for single import point:

    from app.models.v2 import Category, Property, Module, ...
"""

# Enums
from app.models.v2.enums import EntityType, IngestStatus
from app.models.v2.draft import (
    ChangeType,
    DraftSource,
    DraftStatus,
)

# Ontology version tracking
from app.models.v2.ontology_version import (
    OntologyVersion,
    OntologyVersionBase,
    OntologyVersionPublic,
)

# Entity models
from app.models.v2.category import Category, CategoryBase, CategoryPublic
from app.models.v2.property import Property, PropertyBase, PropertyPublic
from app.models.v2.subobject import Subobject, SubobjectBase, SubobjectPublic
from app.models.v2.module import Module, ModuleBase, ModulePublic
from app.models.v2.bundle import Bundle, BundleBase, BundlePublic
from app.models.v2.template import Template, TemplateBase, TemplatePublic

# Relationship tables
from app.models.v2.relationships import (
    BundleModule,
    CategoryParent,
    CategoryProperty,
    ModuleEntity,
)

# Materialized view
from app.models.v2.category_property_effective import (
    CATEGORY_PROPERTY_EFFECTIVE_INDEX_SQL,
    CATEGORY_PROPERTY_EFFECTIVE_REFRESH_SQL,
    CATEGORY_PROPERTY_EFFECTIVE_SQL,
    DROP_CATEGORY_PROPERTY_EFFECTIVE_SQL,
    CategoryPropertyEffective,
    refresh_category_property_effective,
)

# Draft models
from app.models.v2.draft import (
    Draft,
    DraftChange,
    DraftChangePublic,
    DraftPublic,
)

__all__ = [
    # Enums
    "EntityType",
    "IngestStatus",
    "DraftStatus",
    "ChangeType",
    "DraftSource",
    # Ontology version
    "OntologyVersion",
    "OntologyVersionBase",
    "OntologyVersionPublic",
    # Category
    "Category",
    "CategoryBase",
    "CategoryPublic",
    # Property
    "Property",
    "PropertyBase",
    "PropertyPublic",
    # Subobject
    "Subobject",
    "SubobjectBase",
    "SubobjectPublic",
    # Module
    "Module",
    "ModuleBase",
    "ModulePublic",
    # Bundle
    "Bundle",
    "BundleBase",
    "BundlePublic",
    # Template
    "Template",
    "TemplateBase",
    "TemplatePublic",
    # Relationship tables
    "CategoryParent",
    "CategoryProperty",
    "ModuleEntity",
    "BundleModule",
    # Materialized view
    "CategoryPropertyEffective",
    "CATEGORY_PROPERTY_EFFECTIVE_SQL",
    "CATEGORY_PROPERTY_EFFECTIVE_INDEX_SQL",
    "CATEGORY_PROPERTY_EFFECTIVE_REFRESH_SQL",
    "DROP_CATEGORY_PROPERTY_EFFECTIVE_SQL",
    "refresh_category_property_effective",
    # Draft models
    "Draft",
    "DraftChange",
    "DraftPublic",
    "DraftChangePublic",
]
