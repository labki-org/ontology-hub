"""Draft models for proposal management with capability URL security."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class DraftStatus(str, Enum):
    """Status of a draft proposal."""

    PENDING = "pending"
    VALIDATED = "validated"
    SUBMITTED = "submitted"  # PR created
    EXPIRED = "expired"


class DraftBase(SQLModel):
    """Base model for Draft with common fields."""

    status: DraftStatus = DraftStatus.PENDING
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    source_wiki: Optional[str] = None
    base_commit_sha: Optional[str] = None


class Draft(DraftBase, table=True):
    """Draft database table.

    Note: The capability token is NEVER stored, only its SHA-256 hash.
    The capability URL is returned once during creation.
    """

    __tablename__ = "drafts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    capability_hash: str = Field(unique=True, index=True)  # SHA-256 of token
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DraftCreate(SQLModel):
    """Schema for creating a Draft."""

    payload: dict = Field(default_factory=dict)
    source_wiki: Optional[str] = None
    base_commit_sha: Optional[str] = None


class DraftUpdate(SQLModel):
    """Schema for updating a Draft (all fields optional)."""

    status: Optional[DraftStatus] = None
    payload: Optional[dict] = None


class DraftPublic(DraftBase):
    """Public schema for Draft responses (excludes capability_hash for security)."""

    id: uuid.UUID
    expires_at: datetime
    created_at: datetime


class DraftWithCapability(DraftPublic):
    """Response schema including the capability URL (only returned on creation)."""

    capability_url: str
