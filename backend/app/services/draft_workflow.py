"""Draft workflow state machine and transition logic."""

from datetime import datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Draft, DraftStatus


# Valid status transitions (same as drafts_v2.py but centralized)
VALID_TRANSITIONS: dict[DraftStatus, set[DraftStatus]] = {
    DraftStatus.DRAFT: {DraftStatus.VALIDATED},
    DraftStatus.VALIDATED: {DraftStatus.SUBMITTED, DraftStatus.DRAFT},
    DraftStatus.SUBMITTED: {DraftStatus.MERGED, DraftStatus.REJECTED},
    DraftStatus.MERGED: set(),  # Terminal
    DraftStatus.REJECTED: set(),  # Terminal
}


async def get_draft_for_update(
    draft_id: UUID,
    session: AsyncSession,
) -> Draft | None:
    """Get draft with row-level lock for status updates.

    Uses SELECT ... FOR UPDATE to prevent race conditions when
    multiple requests try to modify draft status concurrently.
    """
    # Use SQLModel's with_for_update() method for row-level locking
    result = await session.execute(
        select(Draft).where(Draft.id == draft_id).with_for_update()
    )
    return result.scalar_one_or_none()


async def auto_revert_if_validated(
    draft: Draft,
    session: AsyncSession,
) -> bool:
    """Auto-revert draft status to DRAFT if currently VALIDATED.

    Called when any change is added to a draft. If the draft was
    already validated, this invalidates that validation.

    Returns:
        True if status was reverted, False if no change needed
    """
    if draft.status == DraftStatus.VALIDATED:
        draft.status = DraftStatus.DRAFT
        draft.validated_at = None
        draft.modified_at = datetime.utcnow()
        session.add(draft)
        return True
    return False


def validate_status_transition(
    current_status: DraftStatus,
    new_status: DraftStatus,
) -> tuple[bool, str]:
    """Validate a status transition is allowed.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if new_status == current_status:
        return True, ""

    allowed = VALID_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        allowed_str = ", ".join(s.value for s in allowed) if allowed else "none"
        return False, (
            f"Invalid status transition: {current_status.value} -> {new_status.value}. "
            f"Allowed transitions: {allowed_str}"
        )

    return True, ""


async def transition_to_validated(
    draft_id: UUID,
    session: AsyncSession,
) -> Draft:
    """Transition draft to VALIDATED status.

    Called after validation passes. Uses row lock to prevent races.

    Raises:
        ValueError: If transition not allowed
    """
    draft = await get_draft_for_update(draft_id, session)
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    is_valid, error = validate_status_transition(draft.status, DraftStatus.VALIDATED)
    if not is_valid:
        raise ValueError(error)

    draft.status = DraftStatus.VALIDATED
    draft.validated_at = datetime.utcnow()
    draft.modified_at = datetime.utcnow()
    session.add(draft)

    return draft


async def transition_to_submitted(
    draft_id: UUID,
    pr_url: str,
    session: AsyncSession,
) -> Draft:
    """Transition draft to SUBMITTED status after PR creation.

    Raises:
        ValueError: If transition not allowed
    """
    draft = await get_draft_for_update(draft_id, session)
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    is_valid, error = validate_status_transition(draft.status, DraftStatus.SUBMITTED)
    if not is_valid:
        raise ValueError(error)

    draft.status = DraftStatus.SUBMITTED
    draft.submitted_at = datetime.utcnow()
    draft.modified_at = datetime.utcnow()
    draft.pr_url = pr_url
    session.add(draft)

    return draft
