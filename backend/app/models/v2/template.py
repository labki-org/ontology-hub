"""Template entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class TemplateBase(SQLModel):
    """Base model for Template with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Infobox_Person"
    source_path: str  # Original file path, e.g., "templates/Infobox_Person.json"
    label: str = Field(index=True)
    description: str | None = None
    wikitext: str | None = None  # Template wikitext content
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Template(TemplateBase, table=True):
    """Template entity database table.

    Templates define wikitext templates for MediaWiki rendering.
    """

    __tablename__ = "templates"
    __table_args__ = (sa.UniqueConstraint("entity_key", name="uq_templates_entity_key"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TemplatePublic(TemplateBase):
    """Public schema for Template responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
