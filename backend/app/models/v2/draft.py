"""Draft models for v2.0 change proposals.

Drafts store proposed changes as granular JSON Patch operations (for updates)
or full replacement JSON (for creates). This enables precise diff computation
and auto-rebase when canonical changes.
"""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, Column
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, SQLModel


class DraftStatus(str, Enum):
    """Workflow status for a draft proposal."""

    DRAFT = "draft"  # Initial state, being edited
    VALIDATED = "validated"  # Passed validation checks
    SUBMITTED = "submitted"  # Sent to GitHub as PR
    MERGED = "merged"  # PR merged successfully
    REJECTED = "rejected"  # PR closed without merge


class ChangeType(str, Enum):
    """Type of change in a draft."""

    CREATE = "create"  # New entity
    UPDATE = "update"  # Modify existing entity (uses JSON Patch)
    DELETE = "delete"  # Remove entity


class DraftSource(str, Enum):
    """Origin of the draft proposal."""

    HUB_UI = "hub_ui"  # Created via Ontology Hub web interface
    MEDIAWIKI_PUSH = "mediawiki_push"  # Pushed from MediaWiki instance


class Draft(SQLModel, table=True):
    """Draft proposal containing one or more entity changes.

    A draft is accessed via capability URL (hashed token). It stores
    the base_commit_sha for auto-rebase detection when canonical changes.
    """

    __tablename__ = "draft"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    capability_hash: str = Field(unique=True, index=True)  # SHA-256 of token
    base_commit_sha: str  # For auto-rebase detection
    status: DraftStatus = Field(
        default=DraftStatus.DRAFT, sa_column=Column(SAEnum(DraftStatus))
    )
    source: DraftSource = Field(sa_column=Column(SAEnum(DraftSource)))
    title: str | None = None  # Auto-generated or user-provided
    description: str | None = None  # Auto-generated summary
    user_comment: str | None = None  # User-editable notes

    # Timestamps for workflow tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modified_at: datetime = Field(default_factory=datetime.utcnow)
    validated_at: datetime | None = None
    submitted_at: datetime | None = None
    expires_at: datetime  # TTL expiration

    # Rebase tracking
    rebase_status: str | None = None  # "clean", "conflict", "pending"
    rebase_commit_sha: str | None = None  # New canonical after rebase

    # Legacy fields for compatibility during transition
    pr_url: str | None = None


class DraftChange(SQLModel, table=True):
    """Individual change within a draft.

    For CREATE operations: replacement_json contains the full entity.
    For UPDATE operations: patch contains RFC 6902 JSON Patch operations.
    For DELETE operations: both are null.
    """

    __tablename__ = "draft_change"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    draft_id: uuid.UUID = Field(foreign_key="draft.id", index=True)
    change_type: ChangeType = Field(sa_column=Column(SAEnum(ChangeType)))
    entity_type: str  # "category", "property", etc. (string, not enum FK)
    entity_key: str = Field(index=True)  # The entity being changed
    patch: dict | None = Field(
        default=None, sa_column=Column(JSON)
    )  # JSON Patch for updates
    replacement_json: dict | None = Field(
        default=None, sa_column=Column(JSON)
    )  # Full JSON for creates
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DraftPublic(SQLModel):
    """Public schema for Draft responses."""

    id: uuid.UUID
    status: DraftStatus
    source: DraftSource
    title: str | None
    description: str | None
    user_comment: str | None
    created_at: datetime
    modified_at: datetime
    expires_at: datetime
    rebase_status: str | None


class DraftChangePublic(SQLModel):
    """Public schema for DraftChange responses."""

    id: uuid.UUID
    change_type: ChangeType
    entity_type: str
    entity_key: str
    patch: dict | None
    replacement_json: dict | None
    created_at: datetime
