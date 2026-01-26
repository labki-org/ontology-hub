"""SQLModel database models.

All table models must be imported here before SQLModel.metadata.create_all runs.
Re-exports v2 models for backwards compatibility.
"""

from app.models.v2 import (
    Bundle,
    BundleBase,
    BundleModule,
    BundlePublic,
    Category,
    CategoryBase,
    CategoryParent,
    CategoryProperty,
    CategoryPropertyEffective,
    CategoryPublic,
    CategorySubobject,
    ChangeType,
    Draft,
    DraftChange,
    DraftChangePublic,
    DraftPublic,
    DraftSource,
    DraftStatus,
    EntityType,
    IngestStatus,
    Module,
    ModuleBase,
    ModuleDependency,
    ModuleEntity,
    ModulePublic,
    OntologyVersion,
    OntologyVersionBase,
    OntologyVersionPublic,
    Property,
    PropertyBase,
    PropertyPublic,
    Subobject,
    SubobjectBase,
    SubobjectProperty,
    SubobjectPublic,
    Template,
    TemplateBase,
    TemplatePublic,
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
    "CategorySubobject",
    "SubobjectProperty",
    "ModuleEntity",
    "ModuleDependency",
    "BundleModule",
    # Materialized view
    "CategoryPropertyEffective",
    # Draft models
    "Draft",
    "DraftChange",
    "DraftPublic",
    "DraftChangePublic",
]
