"""Resource entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ResourceBase(SQLModel):
    """Base model for Resource with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Lab_Logo"
    source_path: str  # Original file path, e.g., "resources/Lab_Logo.json"
    label: str = Field(index=True)
    description: str | None = None
    category_key: str = Field(index=True)  # Category key (not FK - stored as plain string)
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Resource(ResourceBase, table=True):
    """Resource entity database table.

    Resources define reusable content blocks associated with categories.
    """

    __tablename__ = "resources"
    __table_args__ = (sa.UniqueConstraint("entity_key", name="uq_resources_entity_key"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ResourcePublic(ResourceBase):
    """Public schema for Resource responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
