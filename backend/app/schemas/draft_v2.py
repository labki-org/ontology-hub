"""Pydantic schemas for v2.0 draft API.

These schemas define the request/response contracts for draft CRUD operations.
Separated from SQLModel models to decouple API contracts from database schema.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.v2 import DraftSource, DraftStatus


class DraftCreate(BaseModel):
    """Request body for creating a new draft.

    The base_commit_sha is NOT in request - server sets it from
    the current OntologyVersion to ensure consistency.
    """

    source: DraftSource = Field(description="Origin of the draft (hub_ui or mediawiki_push)")
    title: Optional[str] = Field(
        default=None,
        description="Draft title (auto-generated if not provided)",
    )
    description: Optional[str] = Field(
        default=None,
        description="Draft description",
    )


class DraftResponse(BaseModel):
    """Public draft response for GET endpoints.

    Includes computed change_count from draft_changes.
    """

    id: UUID
    status: DraftStatus
    source: DraftSource
    title: Optional[str] = None
    description: Optional[str] = None
    user_comment: Optional[str] = None
    base_commit_sha: str = Field(description="Git SHA of canonical version when draft created")
    rebase_status: Optional[str] = Field(
        default=None,
        description="Rebase status: clean, conflict, or pending",
    )
    rebase_commit_sha: Optional[str] = Field(
        default=None,
        description="New canonical SHA after rebase",
    )
    created_at: datetime
    modified_at: datetime
    expires_at: datetime
    change_count: int = Field(
        default=0,
        description="Number of changes in this draft",
    )

    model_config = ConfigDict(from_attributes=True)


class DraftCreateResponse(BaseModel):
    """Response after creating a draft.

    The capability_url is shown ONCE and cannot be recovered.
    Save it immediately - losing it means losing access to the draft.
    """

    capability_url: str = Field(
        description="Capability URL for draft access (SHOWN ONCE - save immediately)"
    )
    draft: DraftResponse
    expires_at: datetime = Field(description="When the draft will expire")


class DraftStatusUpdate(BaseModel):
    """Request body for updating draft status.

    Supports status transitions:
    - DRAFT -> VALIDATED
    - VALIDATED -> SUBMITTED
    - SUBMITTED -> MERGED
    - SUBMITTED -> REJECTED
    """

    status: DraftStatus = Field(description="New status for the draft")
    user_comment: Optional[str] = Field(
        default=None,
        description="Optional user notes to attach to draft",
    )
