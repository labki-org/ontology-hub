"""Main validation orchestrator for draft payloads."""

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import DraftPayload
from app.schemas.validation import DraftValidationReport, ValidationResult
from app.services.validation.datatype import check_datatypes
from app.services.validation.inheritance import check_circular_inheritance
from app.services.validation.reference import check_references


async def validate_draft(
    payload: DraftPayload,
    session: AsyncSession,
) -> DraftValidationReport:
    """Run all validation checks on draft payload.

    Checks:
    1. Reference existence (VALD-01)
    2. Circular inheritance detection (VALD-02)
    3. Datatype validation (VALD-03)

    Breaking change detection (VALD-04, VALD-05) is handled by Plan 02.

    Args:
        payload: Draft payload with entities, modules, profiles
        session: Database session for canonical data lookup

    Returns:
        DraftValidationReport with all findings
    """
    results: list[ValidationResult] = []

    # 1. Reference existence checks
    results.extend(await check_references(payload, session))

    # 2. Circular inheritance detection
    results.extend(await check_circular_inheritance(payload, session))

    # 3. Datatype validation
    results.extend(check_datatypes(payload))

    # Separate by severity
    errors = [r for r in results if r.severity == "error"]
    warnings = [r for r in results if r.severity == "warning"]
    info = [r for r in results if r.severity == "info"]

    # Default semver (will be enhanced by breaking change detection in Plan 02)
    suggested_semver: str = "patch"
    semver_reasons: list[str] = ["No changes analyzed yet"]

    if errors:
        semver_reasons = ["Validation errors must be resolved first"]

    return DraftValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        info=info,
        suggested_semver=suggested_semver,  # type: ignore
        semver_reasons=semver_reasons,
    )
