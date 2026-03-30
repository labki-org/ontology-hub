"""Validation schemas for v2 draft validation.

Provides structured validation results with entity_key field for v2 draft model.
"""

from typing import Literal

from pydantic import BaseModel


class ValidationResultV2(BaseModel):
    """Single validation finding for v2 draft validation."""

    entity_type: Literal[
        "category", "property", "subobject", "module", "bundle", "template", "dashboard", "resource"
    ]
    entity_key: str  # v2 uses entity_key (not entity_id)
    field_path: str | None = None  # JSON path like "/parents/0" or "label"
    code: (
        str  # Machine-readable: "MISSING_PARENT", "CIRCULAR_INHERITANCE", "SCHEMA_VIOLATION", etc.
    )
    message: str  # Human-readable explanation
    severity: Literal["error", "warning", "info"]


class DraftValidationReportV2(BaseModel):
    """Complete validation report for a v2 draft."""

    is_valid: bool  # True if no errors (warnings OK)
    errors: list[ValidationResultV2]
    warnings: list[ValidationResultV2]
    info: list[ValidationResultV2]
