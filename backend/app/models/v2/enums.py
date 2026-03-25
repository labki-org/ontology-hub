"""Shared enums for v2.0 models."""

from enum import StrEnum


class IngestStatus(StrEnum):
    """Status of ontology ingest operation."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class EntityType(StrEnum):
    """Types of schema entities in v2.0 (extended from v1.0)."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"
    MODULE = "module"
    BUNDLE = "bundle"
    TEMPLATE = "template"
    DASHBOARD = "dashboard"
    RESOURCE = "resource"
