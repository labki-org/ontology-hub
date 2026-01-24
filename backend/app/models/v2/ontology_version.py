"""Ontology version tracking model for v2.0."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, Enum
from sqlmodel import Field, SQLModel

from app.models.v2.enums import IngestStatus


class OntologyVersionBase(SQLModel):
    """Base model for OntologyVersion with common fields."""

    commit_sha: str = Field(index=True)  # Git commit SHA from labki-schemas
    ingest_status: IngestStatus = Field(
        default=IngestStatus.PENDING,
        sa_column=Column(Enum(IngestStatus)),
    )
    entity_counts: dict | None = Field(
        default=None, sa_column=Column(JSON)
    )  # {"category": 10, "property": 20, ...}
    warnings: list | None = Field(
        default=None, sa_column=Column(JSON)
    )  # Ingest warnings
    errors: list | None = Field(
        default=None, sa_column=Column(JSON)
    )  # Ingest errors
    ingested_at: datetime | None = None


class OntologyVersion(OntologyVersionBase, table=True):
    """Ontology version database table.

    Tracks the current canonical state of the ontology.
    Only ONE row exists at a time (latest version), but stored as table
    for flexibility and to support future versioning features.
    """

    __tablename__ = "ontology_version"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OntologyVersionPublic(OntologyVersionBase):
    """Public schema for OntologyVersion responses."""

    id: uuid.UUID
    created_at: datetime
