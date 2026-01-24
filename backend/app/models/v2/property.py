"""Property entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class PropertyBase(SQLModel):
    """Base model for Property with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "hasName"
    source_path: str  # Original file path, e.g., "properties/hasName.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Property(PropertyBase, table=True):
    """Property entity database table.

    Properties define data fields that can be attached to categories.
    """

    __tablename__ = "properties"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_properties_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PropertyPublic(PropertyBase):
    """Public schema for Property responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
