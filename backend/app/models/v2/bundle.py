"""Bundle entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class BundleBase(SQLModel):
    """Base model for Bundle with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "research-lab"
    source_path: str  # Original file path, e.g., "bundles/research-lab.json"
    label: str = Field(index=True)
    description: str | None = None
    version: str | None = None  # Semver version, e.g., "1.0.0"
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Bundle(BundleBase, table=True):
    """Bundle entity database table.

    Bundles are collections of modules for deployment as a unit.
    """

    __tablename__ = "bundles"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_bundles_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BundlePublic(BundleBase):
    """Public schema for Bundle responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
