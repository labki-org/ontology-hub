"""Module entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ModuleBase(SQLModel):
    """Base model for Module with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "core"
    source_path: str  # Original file path, e.g., "modules/core.json"
    label: str = Field(index=True)
    description: str | None = None
    version: str | None = None  # Semver version, e.g., "1.0.0"
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Module(ModuleBase, table=True):
    """Module entity database table.

    Modules are logical groupings of categories, properties, and subobjects.
    """

    __tablename__ = "modules_v2"
    __table_args__ = (sa.UniqueConstraint("entity_key", name="uq_modules_v2_entity_key"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ModulePublic(ModuleBase):
    """Public schema for Module responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
