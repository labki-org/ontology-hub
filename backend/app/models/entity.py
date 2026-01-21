"""Entity models for categories, properties, and subobjects."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class EntityType(str, Enum):
    """Types of schema entities."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"


class EntityBase(SQLModel):
    """Base model for Entity with common fields."""

    entity_id: str = Field(index=True)  # Schema-defined ID (e.g., "Person", "hasName")
    entity_type: EntityType
    label: str
    description: Optional[str] = None
    schema_definition: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Entity(EntityBase, table=True):
    """Entity database table."""

    __tablename__ = "entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    commit_sha: Optional[str] = None  # For versioning from GitHub
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None  # Soft delete


class EntityCreate(EntityBase):
    """Schema for creating an Entity."""

    pass


class EntityUpdate(SQLModel):
    """Schema for updating an Entity (all fields optional)."""

    entity_id: Optional[str] = None
    entity_type: Optional[EntityType] = None
    label: Optional[str] = None
    description: Optional[str] = None
    schema_definition: Optional[dict] = None


class EntityPublic(EntityBase):
    """Public schema for Entity responses."""

    id: uuid.UUID
    commit_sha: Optional[str] = None
    created_at: datetime
    updated_at: datetime
