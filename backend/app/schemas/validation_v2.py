"""Validation schemas for v2 draft validation.

Provides structured validation results with entity_key field for v2 draft model.
"""

from typing import Literal, Optional

from pydantic import BaseModel


class ValidationResultV2(BaseModel):
    """Single validation finding for v2 draft validation."""

    entity_type: Literal["category", "property", "subobject", "module", "bundle", "template"]
    entity_key: str  # v2 uses entity_key (not entity_id)
    field_path: Optional[str] = None  # JSON path like "/parents/0" or "label"
    code: str  # Machine-readable: "MISSING_PARENT", "CIRCULAR_INHERITANCE", "SCHEMA_VIOLATION", etc.
    message: str  # Human-readable explanation
    severity: Literal["error", "warning", "info"]
    suggested_semver: Optional[Literal["major", "minor", "patch"]] = None

    # For breaking changes, include old/new values
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class DraftValidationReportV2(BaseModel):
    """Complete validation report for a v2 draft."""

    is_valid: bool  # True if no errors (warnings OK)
    errors: list[ValidationResultV2]
    warnings: list[ValidationResultV2]
    info: list[ValidationResultV2]

    # Aggregate semver recommendation
    suggested_semver: Literal["major", "minor", "patch"]
    semver_reasons: list[str]  # ["Datatype changed: has_name Text -> Number"]

    # Per-module/bundle version suggestions
    module_suggestions: dict[str, str] = {}  # module_key -> suggested version
    bundle_suggestions: dict[str, str] = {}  # bundle_key -> suggested version
