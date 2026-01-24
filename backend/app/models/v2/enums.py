"""Shared enums for v2.0 models."""

from enum import Enum


class IngestStatus(str, Enum):
    """Status of ontology ingest operation."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class EntityType(str, Enum):
    """Types of schema entities in v2.0 (extended from v1.0)."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"
    MODULE = "module"
    BUNDLE = "bundle"
    TEMPLATE = "template"
