"""Draft models for proposal management with capability URL security."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class DraftStatus(str, Enum):
    """Status of a draft proposal."""

    PENDING = "pending"
    VALIDATED = "validated"
    SUBMITTED = "submitted"  # PR created
    EXPIRED = "expired"


# --- Payload schemas for draft creation ---


class EntityDefinition(SQLModel):
    """Individual entity definition within a draft payload."""

    entity_id: str
    label: str
    description: Optional[str] = None
    schema_definition: dict = Field(default_factory=dict)

    model_config = ConfigDict(extra="forbid")


class ModuleDefinition(SQLModel):
    """Module definition within a draft payload."""

    module_id: str
    label: str
    description: Optional[str] = None
    category_ids: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ProfileDefinition(SQLModel):
    """Profile definition within a draft payload."""

    profile_id: str
    label: str
    description: Optional[str] = None
    module_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class EntitiesPayload(SQLModel):
    """Container for entity arrays in draft payload."""

    categories: list[EntityDefinition] = Field(default_factory=list)
    properties: list[EntityDefinition] = Field(default_factory=list)
    subobjects: list[EntityDefinition] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DraftPayload(SQLModel):
    """Validated payload structure for draft creation.

    Contains wiki metadata and full schema data for categories,
    properties, subobjects, modules, and profiles.
    """

    wiki_url: str
    base_version: str
    entities: EntitiesPayload
    modules: list[ModuleDefinition] = Field(default_factory=list)
    profiles: list[ProfileDefinition] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")

    @field_validator("wiki_url")
    @classmethod
    def validate_wiki_url(cls, v: str) -> str:
        """Validate wiki_url is non-empty."""
        if not v or not v.strip():
            raise ValueError("wiki_url cannot be empty")
        return v.strip()

    @field_validator("base_version")
    @classmethod
    def validate_base_version(cls, v: str) -> str:
        """Validate base_version is non-empty."""
        if not v or not v.strip():
            raise ValueError("base_version cannot be empty")
        return v.strip()


# --- Validation error schema ---


class ValidationError(SQLModel):
    """Validation error or warning for draft payload."""

    field: str
    message: str
    severity: Literal["error", "warning"]

    model_config = ConfigDict(extra="forbid")


# --- Diff response schemas ---


class ChangeDetail(SQLModel):
    """Details of a single entity change."""

    key: str
    entity_type: str
    entity_id: str
    old: Optional[dict] = None
    new: Optional[dict] = None


class ChangesByType(SQLModel):
    """Changes grouped by change type (added/modified/deleted)."""

    added: list[ChangeDetail] = Field(default_factory=list)
    modified: list[ChangeDetail] = Field(default_factory=list)
    deleted: list[ChangeDetail] = Field(default_factory=list)


class DraftDiffResponse(SQLModel):
    """Diff response comparing draft to canonical data.

    Structure matches VersionDiffResponse for consistency.
    """

    old_version: str = "canonical"
    new_version: str = "draft"
    categories: ChangesByType = Field(default_factory=ChangesByType)
    properties: ChangesByType = Field(default_factory=ChangesByType)
    subobjects: ChangesByType = Field(default_factory=ChangesByType)
    modules: ChangesByType = Field(default_factory=ChangesByType)
    profiles: ChangesByType = Field(default_factory=ChangesByType)


# --- Database model ---


class DraftBase(SQLModel):
    """Base model for Draft with common fields."""

    status: DraftStatus = DraftStatus.PENDING
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    source_wiki: Optional[str] = None
    base_commit_sha: Optional[str] = None
    diff_preview: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    validation_results: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    pr_url: Optional[str] = None


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


# --- Request/Response schemas ---


class DraftCreate(SQLModel):
    """Schema for creating a Draft with validated payload."""

    payload: DraftPayload


class EntityUpdate(SQLModel):
    """Partial entity update."""

    entity_id: str
    label: Optional[str] = None
    description: Optional[str] = None
    schema_definition: Optional[dict] = None


class EntitiesUpdate(SQLModel):
    """Container for partial entity updates."""

    categories: list[EntityUpdate] = Field(default_factory=list)
    properties: list[EntityUpdate] = Field(default_factory=list)
    subobjects: list[EntityUpdate] = Field(default_factory=list)


class ModuleUpdate(SQLModel):
    """Module assignment update for an entity."""

    entity_id: str
    module_ids: list[str] = Field(default_factory=list)


class ProfileUpdate(SQLModel):
    """Profile module list update."""

    profile_id: str
    module_ids: list[str] = Field(default_factory=list)


class DraftPatchPayload(SQLModel):
    """Payload for PATCH draft endpoint.

    All fields are optional for partial updates.
    """

    entities: Optional[EntitiesUpdate] = None
    modules: Optional[list[ModuleUpdate | ModuleDefinition]] = None
    profiles: Optional[list[ProfileUpdate | ProfileDefinition]] = None

    model_config = ConfigDict(extra="forbid")


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


class DraftCreateResponse(SQLModel):
    """Response schema for draft creation.

    Contains the capability URL (shown ONCE, cannot be recovered),
    expiration info, diff preview, validation results, and any validation warnings.
    """

    capability_url: str
    expires_at: datetime
    diff_preview: Optional[DraftDiffResponse] = None
    validation_results: Optional[dict] = None  # Full validation report
    validation_warnings: list[ValidationError] = Field(default_factory=list)
    message: str = "Save this URL - it cannot be recovered. Use it to access your draft."
