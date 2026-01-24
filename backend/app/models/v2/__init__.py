"""v2.0 entity models package.

This module re-exports all v2.0 models for single import point:

    from app.models.v2 import Category, Property, Module, ...
"""

# Enums
from app.models.v2.enums import EntityType, IngestStatus

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

__all__ = [
    # Enums
    "EntityType",
    "IngestStatus",
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
]
