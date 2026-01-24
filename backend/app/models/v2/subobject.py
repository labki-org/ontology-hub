"""Subobject entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class SubobjectBase(SQLModel):
    """Base model for Subobject with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Address"
    source_path: str  # Original file path, e.g., "subobjects/Address.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Subobject(SubobjectBase, table=True):
    """Subobject entity database table.

    Subobjects are nested structured types that can be embedded within categories.
    """

    __tablename__ = "subobjects"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_subobjects_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SubobjectPublic(SubobjectBase):
    """Public schema for Subobject responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
