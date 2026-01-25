"""Semver classification for validation results.

Uses SchemaVer-inspired rules adapted for SemanticSchemas:
- MAJOR: Breaking changes that require consumer updates
- MINOR: Backward-compatible additions
- PATCH: Metadata-only changes
"""

from typing import Literal

from typing import Union
from app.schemas.validation import ValidationResult
from app.schemas.validation_v2 import ValidationResultV2

# Codes that indicate major (breaking) changes
MAJOR_CODES = {
    "DATATYPE_CHANGED",
    "CARDINALITY_RESTRICTED",
    "PROPERTY_REMOVED",
    "ENTITY_REMOVED",
}

# Codes that indicate minor (addition) changes
MINOR_CODES = {
    "ENTITY_ADDED",
    "PROPERTY_ADDED",
    "CARDINALITY_RELAXED",
}

# Codes that indicate patch (metadata) changes
PATCH_CODES = {
    "LABEL_CHANGED",
    "DESCRIPTION_CHANGED",
}


def classify_change(code: str) -> Literal["major", "minor", "patch"]:
    """Classify a change code into semver category.

    Args:
        code: The validation result code (e.g., "DATATYPE_CHANGED")

    Returns:
        Semver category: "major", "minor", or "patch"
    """
    if code in MAJOR_CODES:
        return "major"
    elif code in MINOR_CODES:
        return "minor"
    else:
        return "patch"


def compute_semver_suggestion(
    results: list[Union[ValidationResult, ValidationResultV2]],
) -> tuple[Literal["major", "minor", "patch"], list[str]]:
    """Compute aggregate semver suggestion from validation results.

    Logic:
    - Any major suggestion -> overall major
    - No major, any minor -> overall minor
    - Otherwise -> patch

    Args:
        results: List of ValidationResult or ValidationResultV2 objects

    Returns:
        Tuple of (suggested_semver, reasons_list)
    """
    major_reasons: list[str] = []
    minor_reasons: list[str] = []
    patch_reasons: list[str] = []

    for result in results:
        # Handle both v1 (entity_id) and v2 (entity_key) result types
        entity_identifier = getattr(result, 'entity_key', None) or getattr(result, 'entity_id', 'unknown')

        if result.suggested_semver == "major":
            reason = f"{result.code}: {entity_identifier}"
            if result.old_value and result.new_value:
                reason += f" ({result.old_value} -> {result.new_value})"
            elif result.old_value:
                reason += f" (removed: {result.old_value})"
            major_reasons.append(reason)

        elif result.suggested_semver == "minor":
            reason = f"{result.code}: {entity_identifier}"
            if result.new_value:
                reason += f" ({result.new_value})"
            minor_reasons.append(reason)

        elif result.suggested_semver == "patch":
            patch_reasons.append(f"{result.code}: {entity_identifier}")

    # Determine overall suggestion (major > minor > patch)
    if major_reasons:
        return "major", major_reasons
    elif minor_reasons:
        return "minor", minor_reasons
    elif patch_reasons:
        return "patch", patch_reasons
    else:
        return "patch", ["No changes detected"]
