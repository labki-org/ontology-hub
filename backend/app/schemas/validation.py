"""Validation schemas for draft payload validation.

Provides structured validation results with entity context and semver suggestions.
"""

from typing import Literal

from pydantic import BaseModel


class ValidationResult(BaseModel):
    """Single validation finding with entity context."""

    entity_type: Literal["category", "property", "subobject", "module", "profile"]
    entity_id: str
    field: str | None = None  # Specific field, if applicable
    code: str  # Machine-readable: "MISSING_PARENT", "CIRCULAR_INHERITANCE", etc.
    message: str  # Human-readable explanation
    severity: Literal["error", "warning", "info"]
    suggested_semver: Literal["major", "minor", "patch"] | None = None

    # For breaking changes, include old/new values
    old_value: str | None = None
    new_value: str | None = None


class DraftValidationReport(BaseModel):
    """Complete validation report for a draft."""

    is_valid: bool  # True if no errors (warnings OK)
    errors: list[ValidationResult]
    warnings: list[ValidationResult]
    info: list[ValidationResult]

    # Aggregate semver recommendation
    suggested_semver: Literal["major", "minor", "patch"]
    semver_reasons: list[str]  # ["Datatype changed: has_name Text -> Number"]
