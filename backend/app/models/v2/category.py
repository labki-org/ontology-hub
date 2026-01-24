"""Category entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CategoryBase(SQLModel):
    """Base model for Category with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Person"
    source_path: str  # Original file path, e.g., "categories/Person.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Category(CategoryBase, table=True):
    """Category entity database table.

    Categories define types of wiki pages with associated properties.
    """

    __tablename__ = "categories"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_categories_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CategoryPublic(CategoryBase):
    """Public schema for Category responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
