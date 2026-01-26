"""Entity models for categories, properties, and subobjects."""

import uuid
from datetime import datetime
from enum import Enum

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, SQLModel


class EntityType(str, Enum):
    """Types of schema entities."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"


class EntityBase(SQLModel):
    """Base model for Entity with common fields."""

    entity_id: str = Field(index=True)  # Schema-defined ID (e.g., "Person", "hasName")
    entity_type: EntityType = Field(
        sa_column=Column(
            SAEnum(EntityType, name="entitytype", values_callable=lambda e: [x.value for x in e])
        )
    )
    label: str
    description: str | None = None
    schema_definition: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Entity(EntityBase, table=True):
    """Entity database table."""

    __tablename__ = "entities"
    __table_args__ = (
        sa.UniqueConstraint("entity_id", "entity_type", name="uq_entities_entity_id_type"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    commit_sha: str | None = None  # For versioning from GitHub
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None  # Soft delete


class EntityCreate(EntityBase):
    """Schema for creating an Entity."""

    pass


class EntityUpdate(SQLModel):
    """Schema for updating an Entity (all fields optional)."""

    entity_id: str | None = None
    entity_type: EntityType | None = None
    label: str | None = None
    description: str | None = None
    schema_definition: dict | None = None


class EntityPublic(EntityBase):
    """Public schema for Entity responses."""

    id: uuid.UUID
    commit_sha: str | None = None
    created_at: datetime
    updated_at: datetime
