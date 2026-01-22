"""Main validation orchestrator for draft payloads."""

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import DraftPayload
from app.schemas.validation import DraftValidationReport, ValidationResult
from app.services.validation.breaking import detect_breaking_changes
from app.services.validation.datatype import check_datatypes
from app.services.validation.inheritance import check_circular_inheritance
from app.services.validation.reference import check_references
from app.services.validation.semver import compute_semver_suggestion


async def validate_draft(
    payload: DraftPayload,
    session: AsyncSession,
) -> DraftValidationReport:
    """Run all validation checks on draft payload.

    Performs:
    1. Reference existence checks (VALD-01)
    2. Circular inheritance detection (VALD-02)
    3. Datatype validation (VALD-03)
    4. Breaking change detection (VALD-04)
    5. Semver classification (VALD-05)

    Args:
        payload: Validated draft payload with entities, modules, profiles
        session: Async database session for canonical data lookup

    Returns:
        DraftValidationReport with all findings and semver suggestion
    """
    results: list[ValidationResult] = []

    # 1. Reference existence checks (errors)
    results.extend(await check_references(payload, session))

    # 2. Circular inheritance detection (errors)
    results.extend(await check_circular_inheritance(payload, session))

    # 3. Datatype validation (errors)
    results.extend(check_datatypes(payload))

    # 4. Breaking change detection (warnings/info)
    results.extend(await detect_breaking_changes(payload, session))

    # Separate by severity
    errors = [r for r in results if r.severity == "error"]
    warnings = [r for r in results if r.severity == "warning"]
    info = [r for r in results if r.severity == "info"]

    # 5. Compute semver suggestion
    if errors:
        # Don't suggest semver until errors are resolved
        suggested_semver = "patch"
        semver_reasons = ["Resolve validation errors before semver classification"]
    else:
        # Filter to results with semver suggestions (breaking change results)
        semver_results = [r for r in results if r.suggested_semver]
        suggested_semver, semver_reasons = compute_semver_suggestion(semver_results)

    return DraftValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        info=info,
        suggested_semver=suggested_semver,
        semver_reasons=semver_reasons,
    )
