"""Validation services for draft payloads.

Provides reference existence checks, circular inheritance detection,
datatype validation, breaking change detection, and semver classification.
"""

from app.services.validation.breaking import detect_breaking_changes_v2
from app.services.validation.datatype import ALLOWED_DATATYPES
from app.services.validation.semver import classify_change, compute_semver_suggestion
from app.services.validation.validator import validate_draft_v2

__all__ = [
    "validate_draft_v2",
    "ALLOWED_DATATYPES",
    "compute_semver_suggestion",
    "classify_change",
    "detect_breaking_changes_v2",
]
