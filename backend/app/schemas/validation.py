"""Validation schemas for draft payload validation.

Provides structured validation results with entity context and semver suggestions.
"""

from typing import Literal, Optional

from pydantic import BaseModel


class ValidationResult(BaseModel):
    """Single validation finding with entity context."""

    entity_type: Literal["category", "property", "subobject", "module", "profile"]
    entity_id: str
    field: Optional[str] = None  # Specific field, if applicable
    code: str  # Machine-readable: "MISSING_PARENT", "CIRCULAR_INHERITANCE", etc.
    message: str  # Human-readable explanation
    severity: Literal["error", "warning", "info"]
    suggested_semver: Optional[Literal["major", "minor", "patch"]] = None

    # For breaking changes, include old/new values
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class DraftValidationReport(BaseModel):
    """Complete validation report for a draft."""

    is_valid: bool  # True if no errors (warnings OK)
    errors: list[ValidationResult]
    warnings: list[ValidationResult]
    info: list[ValidationResult]

    # Aggregate semver recommendation
    suggested_semver: Literal["major", "minor", "patch"]
    semver_reasons: list[str]  # ["Datatype changed: has_name Text -> Number"]
