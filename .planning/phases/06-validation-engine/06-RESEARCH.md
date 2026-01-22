# Phase 6: Validation Engine - Research

**Researched:** 2026-01-22
**Domain:** Schema validation, breaking change detection, semver classification, inline validation feedback
**Confidence:** HIGH

## Summary

Phase 6 implements a validation engine for the draft system that checks consistency (references, circular inheritance, datatypes), detects breaking changes, suggests semver classification, and displays feedback inline in the draft UI. The foundation is already in place: the draft system stores full schema payloads with diff_preview, the inheritance service has cycle detection logic, and the UI has components for displaying field-level diffs with severity indicators.

The validation approach should run server-side with results stored on the draft and displayed client-side. Validation computes once on draft creation/update and is cached in a `validation_results` field. The key validations are: (1) reference existence (all parent categories, properties, subobjects, module members exist in canonical or draft), (2) circular inheritance detection using Python's `graphlib.TopologicalSorter`, (3) datatype validation against SemanticMediaWiki's allowed set, and (4) breaking change detection by comparing old vs new schema_definition fields.

For semver classification, use the SchemaVer model adapted for this domain: MAJOR (breaking changes - datatype changes, multiplicity changes from multiple to single, removals of required fields), MINOR (new entities, new optional fields), PATCH (metadata changes like label/description). The existing `ValidationError` schema can be extended to include entity_id, change_type, and suggested_semver fields.

**Primary recommendation:** Implement validation as a backend service that runs on draft create/update. Store validation results in draft.validation_results JSONB field. Frontend displays results inline using existing diff viewer components with color-coded severity badges. Use graphlib for cycle detection.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| graphlib | stdlib | Cycle detection | Built-in Python, handles TopologicalSorter with CycleError |
| Pydantic | 2.x | Validation schemas | Already used for all API schemas |
| SQLModel | 0.x | Database models | Already in use |
| jsondiffpatch | 0.7.3 | Field-level diff | Already used for diff computation |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Alert | latest | Validation feedback UI | Error/warning display inline |
| lucide-react | 0.562+ | Status icons | AlertTriangle, CheckCircle, Info |
| Badge | shadcn | Severity indicators | Error (red), Warning (yellow), Info (blue) |

### No New Dependencies Required
This phase requires no new dependencies. All validation logic uses standard Python, and UI components already exist.

**Installation:**
```bash
# No new dependencies needed
# graphlib is Python 3.9+ standard library
```

## Architecture Patterns

### Recommended Project Structure Additions
```
backend/app/
├── services/
│   ├── validation/              # New validation module
│   │   ├── __init__.py
│   │   ├── validator.py         # Main validation orchestrator
│   │   ├── reference.py         # Reference existence checks
│   │   ├── inheritance.py       # Circular inheritance detection
│   │   ├── datatype.py          # Datatype validation
│   │   ├── breaking.py          # Breaking change detection
│   │   └── semver.py            # Semver classification
│   └── draft_diff.py            # Existing (unchanged)
├── schemas/
│   └── validation.py            # Extended validation schemas
└── models/
    └── draft.py                 # Add validation_results field

frontend/src/
├── components/
│   └── draft/
│       ├── ValidationSummary.tsx    # Summary of validation results
│       ├── ValidationBadge.tsx      # Inline severity badge
│       └── DraftDiffViewer.tsx      # Extend with validation display
└── api/
    └── types.ts                     # Extended validation types
```

### Pattern 1: Validation Result Schema

**What:** Structured validation result with entity context and semver suggestions
**When to use:** All validation checks
**Example:**
```python
# backend/app/schemas/validation.py
# Source: Existing ValidationError + requirements
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
```

### Pattern 2: Validation Orchestrator

**What:** Main validator that runs all checks and aggregates results
**When to use:** Draft creation and update
**Example:**
```python
# backend/app/services/validation/validator.py
# Source: Phase requirements + existing patterns
from app.schemas.validation import DraftValidationReport, ValidationResult
from app.services.validation.reference import check_references
from app.services.validation.inheritance import check_circular_inheritance
from app.services.validation.datatype import check_datatypes
from app.services.validation.breaking import detect_breaking_changes

async def validate_draft(
    payload: DraftPayload,
    session: AsyncSession,
) -> DraftValidationReport:
    """Run all validation checks on draft payload.

    Args:
        payload: Draft payload with entities, modules, profiles
        session: Database session for canonical data lookup

    Returns:
        DraftValidationReport with all findings
    """
    results: list[ValidationResult] = []

    # 1. Reference existence checks (VALD-01)
    results.extend(await check_references(payload, session))

    # 2. Circular inheritance detection (VALD-02)
    results.extend(check_circular_inheritance(payload))

    # 3. Datatype validation (VALD-03)
    results.extend(check_datatypes(payload))

    # 4. Breaking change detection (VALD-04, VALD-05)
    results.extend(await detect_breaking_changes(payload, session))

    # Separate by severity
    errors = [r for r in results if r.severity == "error"]
    warnings = [r for r in results if r.severity == "warning"]
    info = [r for r in results if r.severity == "info"]

    # Compute aggregate semver
    suggested_semver, reasons = compute_semver_suggestion(results)

    return DraftValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        info=info,
        suggested_semver=suggested_semver,
        semver_reasons=reasons,
    )
```

### Pattern 3: Circular Inheritance Detection with graphlib

**What:** Detect cycles in category parent relationships using Python stdlib
**When to use:** VALD-02 validation
**Example:**
```python
# backend/app/services/validation/inheritance.py
# Source: Python graphlib documentation
from graphlib import TopologicalSorter, CycleError
from app.schemas.validation import ValidationResult
from app.models.draft import DraftPayload

def check_circular_inheritance(payload: DraftPayload) -> list[ValidationResult]:
    """Detect circular inheritance in category parent relationships.

    Uses Python's graphlib.TopologicalSorter for cycle detection.

    Args:
        payload: Draft payload containing categories

    Returns:
        List of ValidationResult for any circular dependencies found
    """
    results: list[ValidationResult] = []

    # Build graph: child -> {parents}
    graph: dict[str, set[str]] = {}

    for category in payload.entities.categories:
        entity_id = category.entity_id
        schema = category.schema_definition
        parent = schema.get("parent")

        if parent:
            graph[entity_id] = {parent}
        else:
            graph[entity_id] = set()

    # Use TopologicalSorter for cycle detection
    ts = TopologicalSorter(graph)

    try:
        ts.prepare()  # Raises CycleError if cycle exists
    except CycleError as e:
        # e.args[1] contains the cycle path
        cycle_path = e.args[1]
        cycle_str = " -> ".join(cycle_path)

        # Report error for each category in the cycle
        for category_id in set(cycle_path):  # Dedupe (first/last are same)
            results.append(ValidationResult(
                entity_type="category",
                entity_id=category_id,
                field="parent",
                code="CIRCULAR_INHERITANCE",
                message=f"Circular inheritance detected: {cycle_str}",
                severity="error",
            ))

    return results
```

### Pattern 4: Reference Existence Validation

**What:** Check that all referenced IDs exist in canonical data or draft
**When to use:** VALD-01 validation
**Example:**
```python
# backend/app/services/validation/reference.py
# Source: Requirements + existing entity patterns
from sqlmodel import select
from app.models.entity import Entity, EntityType
from app.models.module import Module, Profile

async def check_references(
    payload: DraftPayload,
    session: AsyncSession,
) -> list[ValidationResult]:
    """Check all referenced IDs exist in canonical or draft data.

    Validates:
    - Category parent references
    - Category property references
    - Category subobject references
    - Module category_ids
    - Module dependencies
    - Profile module_ids
    """
    results: list[ValidationResult] = []

    # Build sets of all IDs (canonical + draft)
    canonical_categories = await get_canonical_ids(session, EntityType.CATEGORY)
    canonical_properties = await get_canonical_ids(session, EntityType.PROPERTY)
    canonical_subobjects = await get_canonical_ids(session, EntityType.SUBOBJECT)
    canonical_modules = await get_canonical_module_ids(session)

    draft_categories = {c.entity_id for c in payload.entities.categories}
    draft_properties = {p.entity_id for p in payload.entities.properties}
    draft_subobjects = {s.entity_id for s in payload.entities.subobjects}
    draft_modules = {m.module_id for m in (payload.modules or [])}

    all_categories = canonical_categories | draft_categories
    all_properties = canonical_properties | draft_properties
    all_subobjects = canonical_subobjects | draft_subobjects
    all_modules = canonical_modules | draft_modules

    # Check category references
    for category in payload.entities.categories:
        schema = category.schema_definition

        # Parent reference
        parent = schema.get("parent")
        if parent and parent not in all_categories:
            results.append(ValidationResult(
                entity_type="category",
                entity_id=category.entity_id,
                field="parent",
                code="MISSING_PARENT",
                message=f"Parent category '{parent}' does not exist",
                severity="error",
            ))

        # Property references
        for prop_id in schema.get("properties", []):
            if prop_id not in all_properties:
                results.append(ValidationResult(
                    entity_type="category",
                    entity_id=category.entity_id,
                    field="properties",
                    code="MISSING_PROPERTY",
                    message=f"Property '{prop_id}' does not exist",
                    severity="error",
                ))

        # Subobject references
        for sub_id in schema.get("subobjects", []):
            if sub_id not in all_subobjects:
                results.append(ValidationResult(
                    entity_type="category",
                    entity_id=category.entity_id,
                    field="subobjects",
                    code="MISSING_SUBOBJECT",
                    message=f"Subobject '{sub_id}' does not exist",
                    severity="error",
                ))

    # Check module references
    for module in (payload.modules or []):
        for cat_id in module.category_ids:
            if cat_id not in all_categories:
                results.append(ValidationResult(
                    entity_type="module",
                    entity_id=module.module_id,
                    field="category_ids",
                    code="MISSING_CATEGORY",
                    message=f"Category '{cat_id}' does not exist",
                    severity="error",
                ))

        for dep_id in module.dependencies:
            if dep_id not in all_modules:
                results.append(ValidationResult(
                    entity_type="module",
                    entity_id=module.module_id,
                    field="dependencies",
                    code="MISSING_MODULE",
                    message=f"Module dependency '{dep_id}' does not exist",
                    severity="error",
                ))

    return results
```

### Pattern 5: Datatype Validation

**What:** Check property datatypes are in the allowed set
**When to use:** VALD-03 validation
**Example:**
```python
# backend/app/services/validation/datatype.py
# Source: SemanticMediaWiki datatypes list
from app.schemas.validation import ValidationResult

# SemanticMediaWiki allowed datatypes
# Reference: https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes
ALLOWED_DATATYPES = {
    "Annotation URI",
    "Boolean",
    "Code",
    "Date",
    "Email",
    "External identifier",
    "Geographic coordinates",
    "Keyword",
    "Monolingual text",
    "Number",
    "Page",
    "Quantity",
    "Record",
    "Reference",
    "Telephone number",
    "Temperature",
    "Text",
    "URL",
}

def check_datatypes(payload: DraftPayload) -> list[ValidationResult]:
    """Check property datatypes are in the allowed set.

    Args:
        payload: Draft payload containing properties

    Returns:
        List of ValidationResult for invalid datatypes
    """
    results: list[ValidationResult] = []

    for prop in payload.entities.properties:
        schema = prop.schema_definition
        datatype = schema.get("datatype")

        if datatype and datatype not in ALLOWED_DATATYPES:
            results.append(ValidationResult(
                entity_type="property",
                entity_id=prop.entity_id,
                field="datatype",
                code="INVALID_DATATYPE",
                message=f"Datatype '{datatype}' is not valid. Allowed: {', '.join(sorted(ALLOWED_DATATYPES))}",
                severity="error",
            ))

    return results
```

### Pattern 6: Breaking Change Detection

**What:** Detect changes that break backward compatibility
**When to use:** VALD-04, VALD-05 validation
**Example:**
```python
# backend/app/services/validation/breaking.py
# Source: SchemaVer model adapted for SemanticSchemas
from app.schemas.validation import ValidationResult

async def detect_breaking_changes(
    payload: DraftPayload,
    session: AsyncSession,
) -> list[ValidationResult]:
    """Detect breaking changes vs canonical data.

    Breaking changes (MAJOR):
    - Datatype changed (e.g., Text -> Number)
    - Cardinality changed from multiple to single
    - Required field removed
    - Entity deleted

    Non-breaking additions (MINOR):
    - New entity added
    - Cardinality changed from single to multiple (relaxation)
    - New optional field added

    Metadata changes (PATCH):
    - Label changed
    - Description changed
    """
    results: list[ValidationResult] = []

    # Fetch canonical entities
    canonical = await fetch_canonical_entities_map(session)

    # Check properties for breaking changes
    for prop in payload.entities.properties:
        entity_id = prop.entity_id

        if entity_id in canonical["properties"]:
            old_schema = canonical["properties"][entity_id].schema_definition
            new_schema = prop.schema_definition

            # Datatype change detection
            old_datatype = old_schema.get("datatype")
            new_datatype = new_schema.get("datatype")

            if old_datatype and new_datatype and old_datatype != new_datatype:
                results.append(ValidationResult(
                    entity_type="property",
                    entity_id=entity_id,
                    field="datatype",
                    code="DATATYPE_CHANGED",
                    message=f"Datatype changed from '{old_datatype}' to '{new_datatype}' - this is a breaking change",
                    severity="warning",
                    suggested_semver="major",
                    old_value=old_datatype,
                    new_value=new_datatype,
                ))

            # Cardinality change detection
            old_cardinality = old_schema.get("cardinality")
            new_cardinality = new_schema.get("cardinality")

            if old_cardinality == "multiple" and new_cardinality == "single":
                results.append(ValidationResult(
                    entity_type="property",
                    entity_id=entity_id,
                    field="cardinality",
                    code="CARDINALITY_RESTRICTED",
                    message="Cardinality changed from 'multiple' to 'single' - this is a breaking change",
                    severity="warning",
                    suggested_semver="major",
                    old_value="multiple",
                    new_value="single",
                ))
            elif old_cardinality == "single" and new_cardinality == "multiple":
                results.append(ValidationResult(
                    entity_type="property",
                    entity_id=entity_id,
                    field="cardinality",
                    code="CARDINALITY_RELAXED",
                    message="Cardinality changed from 'single' to 'multiple' - backward compatible",
                    severity="info",
                    suggested_semver="minor",
                    old_value="single",
                    new_value="multiple",
                ))

    # Check for deleted entities
    draft_prop_ids = {p.entity_id for p in payload.entities.properties}
    for entity_id, entity in canonical["properties"].items():
        if entity_id not in draft_prop_ids:
            results.append(ValidationResult(
                entity_type="property",
                entity_id=entity_id,
                field=None,
                code="ENTITY_REMOVED",
                message=f"Property '{entity_id}' has been removed - this is a breaking change",
                severity="warning",
                suggested_semver="major",
            ))

    # Similar checks for categories and subobjects...

    return results
```

### Pattern 7: Semver Suggestion Computation

**What:** Aggregate individual findings into overall semver recommendation
**When to use:** Final validation report generation
**Example:**
```python
# backend/app/services/validation/semver.py
# Source: SemVer spec + SchemaVer adaptation

def compute_semver_suggestion(
    results: list[ValidationResult],
) -> tuple[str, list[str]]:
    """Compute aggregate semver suggestion from validation results.

    Logic:
    - Any major suggestion -> overall major
    - No major, any minor -> overall minor
    - Otherwise -> patch (or minor if new entities)

    Returns:
        Tuple of (suggested_semver, reasons_list)
    """
    major_reasons: list[str] = []
    minor_reasons: list[str] = []
    patch_reasons: list[str] = []

    for result in results:
        if result.suggested_semver == "major":
            reason = f"{result.code}: {result.entity_id}"
            if result.old_value and result.new_value:
                reason += f" ({result.old_value} -> {result.new_value})"
            major_reasons.append(reason)
        elif result.suggested_semver == "minor":
            minor_reasons.append(f"{result.code}: {result.entity_id}")
        elif result.suggested_semver == "patch":
            patch_reasons.append(f"{result.code}: {result.entity_id}")

    if major_reasons:
        return "major", major_reasons
    elif minor_reasons:
        return "minor", minor_reasons
    elif patch_reasons:
        return "patch", patch_reasons
    else:
        return "patch", ["No breaking changes detected"]
```

### Pattern 8: Frontend Validation Display

**What:** Inline validation badges and summary in draft UI
**When to use:** VALD-06 display
**Example:**
```typescript
// frontend/src/components/draft/ValidationBadge.tsx
// Source: Existing Badge component + severity indicators
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ValidationResult } from '@/api/types'

interface ValidationBadgeProps {
  result: ValidationResult
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  info: {
    icon: Info,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
}

export function ValidationBadge({ result }: ValidationBadgeProps) {
  const config = severityConfig[result.severity]
  const Icon = config.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${config.className} gap-1 cursor-help`}>
          <Icon className="h-3 w-3" />
          {result.code}
          {result.suggested_semver && (
            <span className="ml-1 opacity-75">({result.suggested_semver})</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{result.message}</p>
        {result.old_value && result.new_value && (
          <p className="text-xs mt-1 opacity-75">
            {result.old_value} → {result.new_value}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
```

### Anti-Patterns to Avoid

- **Running validation on every keystroke:** Validate on save/submit only, not during typing
- **Blocking on warnings:** Errors block submission, warnings are informational only
- **Duplicating validation logic:** Backend is source of truth, frontend displays results
- **Ignoring transitive references:** A -> B -> C means A transitively depends on C
- **Treating all changes as breaking:** Follow semver properly (additions are minor, not major)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Manual DFS | graphlib.TopologicalSorter | Built-in Python, handles CycleError |
| Schema validation | Manual if/else | Pydantic models | Type safety, automatic error messages |
| Diff computation | Manual field compare | jsondiffpatch (already used) | Handles arrays, nested objects, moves |
| Severity badges | Custom styled divs | shadcn Badge + Tooltip | Consistent with existing UI |
| Validation aggregation | Ad-hoc collection | Structured ValidationResult | Type-safe, consistent API |

**Key insight:** Phase 6 is primarily about orchestrating existing capabilities. The inheritance service already has cycle-detection patterns, diff is computed, UI components exist. The new work is structuring validation results and integrating them into the draft flow.

## Common Pitfalls

### Pitfall 1: Reference Check Race Condition

**What goes wrong:** Draft references entity from same draft, but check runs before entity is "seen"
**Why it happens:** Iterating through draft entities in wrong order
**How to avoid:** Build complete set of draft IDs first, then validate references
```python
# Build sets first
draft_categories = {c.entity_id for c in payload.entities.categories}
draft_properties = {p.entity_id for p in payload.entities.properties}

# Then validate against combined canonical + draft
all_categories = canonical_categories | draft_categories
```
**Warning signs:** Valid drafts failing with "missing entity" errors

### Pitfall 2: Cycle Detection Only Checks Draft

**What goes wrong:** Draft category has parent in canonical, canonical has circular path
**Why it happens:** Only building graph from draft categories
**How to avoid:** Include canonical parent relationships when checking draft categories
```python
# Build graph including canonical parents
for category_id in all_category_ids:
    if category_id in draft_map:
        parent = draft_map[category_id].schema_definition.get("parent")
    elif category_id in canonical_map:
        parent = canonical_map[category_id].schema_definition.get("parent")
```
**Warning signs:** Circular inheritance created by combining draft + canonical passes validation

### Pitfall 3: False Positive on Entity "Removal"

**What goes wrong:** Entity marked as "removed" when it was never in the draft payload
**Why it happens:** Comparing draft payload (partial) against full canonical
**How to avoid:** Distinguish between explicit removal and "not included in partial update"
```python
# Only flag removal if entity was modified in some way
# A draft that doesn't mention an entity isn't removing it
if entity_id in draft_touched_entities and entity_id not in draft_current_entities:
    # This is an actual removal
    pass
```
**Warning signs:** Every existing entity flagged as "removed" on new drafts

### Pitfall 4: Semver Suggestion Conflicts

**What goes wrong:** One change suggests minor, another suggests major, result is inconsistent
**Why it happens:** Not aggregating semver properly
**How to avoid:** Use max severity: major > minor > patch
```python
if any(r.suggested_semver == "major" for r in results):
    return "major"
elif any(r.suggested_semver == "minor" for r in results):
    return "minor"
else:
    return "patch"
```
**Warning signs:** PR summary says "minor" but contains breaking changes

### Pitfall 5: Validation Results Not Cached

**What goes wrong:** Validation runs on every draft GET, causing slow responses
**Why it happens:** Computing validation in endpoint handler
**How to avoid:** Store validation_results in draft on create/update, serve from cache
```python
# On draft create/update
validation = await validate_draft(payload, session)
draft.validation_results = validation.model_dump()
```
**Warning signs:** Slow draft page loads, high CPU on draft endpoints

## Code Examples

Verified patterns from official sources and existing codebase:

### Database Schema Extension

```python
# backend/app/models/draft.py additions
# Add validation_results field to Draft model

class DraftBase(SQLModel):
    """Base model for Draft with common fields."""

    status: DraftStatus = DraftStatus.PENDING
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    source_wiki: Optional[str] = None
    base_commit_sha: Optional[str] = None
    diff_preview: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    validation_results: Optional[dict] = Field(default=None, sa_column=Column(JSON))  # NEW
```

### Router Integration

```python
# backend/app/routers/drafts.py - extend create_draft
from app.services.validation.validator import validate_draft

@router.post("/", response_model=DraftCreateResponse, status_code=201)
@limiter.limit(RATE_LIMITS["draft_create"])
async def create_draft(
    request: Request,
    draft_in: DraftCreate,
    session: SessionDep,
) -> DraftCreateResponse:
    payload = draft_in.payload

    # Existing validation warnings
    validation_warnings = validate_draft_payload(payload)

    # NEW: Run full validation engine
    validation_report = await validate_draft(payload, session)

    # Compute diff preview (existing)
    diff_preview = await compute_draft_diff(payload, session)

    # Create draft with validation results
    draft = Draft(
        capability_hash=hash_token(token),
        payload=payload.model_dump(),
        diff_preview=diff_preview.model_dump(),
        validation_results=validation_report.model_dump(),  # NEW
        source_wiki=payload.wiki_url,
        base_commit_sha=payload.base_version,
        expires_at=expires_at,
    )
    # ... rest unchanged
```

### Frontend Types Extension

```typescript
// frontend/src/api/types.ts additions

export interface ValidationResult {
  entity_type: 'category' | 'property' | 'subobject' | 'module' | 'profile'
  entity_id: string
  field: string | null
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
  suggested_semver: 'major' | 'minor' | 'patch' | null
  old_value: string | null
  new_value: string | null
}

export interface DraftValidationReport {
  is_valid: boolean
  errors: ValidationResult[]
  warnings: ValidationResult[]
  info: ValidationResult[]
  suggested_semver: 'major' | 'minor' | 'patch'
  semver_reasons: string[]
}

// Extend DraftPublic
export interface DraftPublic {
  // ... existing fields
  validation_results: DraftValidationReport | null  // NEW
}
```

### Validation Summary Component

```typescript
// frontend/src/components/draft/ValidationSummary.tsx
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DraftValidationReport } from '@/api/types'

interface ValidationSummaryProps {
  report: DraftValidationReport
}

export function ValidationSummary({ report }: ValidationSummaryProps) {
  const StatusIcon = report.is_valid ? CheckCircle : AlertCircle
  const statusColor = report.is_valid
    ? 'text-green-600'
    : 'text-red-600'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
          Validation Results
          <Badge
            className="ml-auto"
            variant={report.suggested_semver === 'major' ? 'destructive' : 'secondary'}
          >
            Suggested: {report.suggested_semver}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.errors.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-red-600 font-medium">
              <AlertCircle className="h-4 w-4" />
              {report.errors.length} Error{report.errors.length !== 1 && 's'}
            </div>
            <ul className="ml-5 mt-1 space-y-1 text-sm">
              {report.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.entity_id}</span>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.warnings.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-yellow-600 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {report.warnings.length} Warning{report.warnings.length !== 1 && 's'}
            </div>
            <ul className="ml-5 mt-1 space-y-1 text-sm">
              {report.warnings.map((w, i) => (
                <li key={i}>
                  <span className="font-mono">{w.entity_id}</span>: {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.semver_reasons.length > 0 && (
          <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
            <span className="font-medium">Semver reasoning:</span>
            <ul className="ml-4 mt-1 list-disc">
              {report.semver_reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual cycle detection | graphlib stdlib | Python 3.9+ | No external deps, CycleError |
| SemVer for schemas | SchemaVer model | 2014 (Snowplow) | Better fit for data schemas |
| Validation on every request | Cached validation_results | Common pattern | Performance |
| Client-side validation | Server-side source of truth | Always preferred | Consistency |

**Deprecated/outdated:**
- Manual DFS for cycles: Use graphlib.TopologicalSorter
- Frontend-only validation: Backend must validate (frontend can display)
- SemVer literal for schemas: SchemaVer (MODEL/REVISION/ADDITION) is better fit, but we adapt to major/minor/patch for user familiarity

## Open Questions

Things that couldn't be fully resolved:

1. **Partial Draft Validation**
   - What we know: Drafts can be partial updates (not all entities)
   - What's unclear: Should missing entities be flagged as "removed"?
   - Recommendation: Require explicit `deleted: true` flag to mark removals, absence means unchanged

2. **Cross-Draft Validation**
   - What we know: Multiple drafts could have conflicting changes
   - What's unclear: Should we warn about concurrent drafts?
   - Recommendation: Out of scope for Phase 6, handle at PR merge time

3. **Canonical Data Freshness**
   - What we know: Validation compares against canonical DB
   - What's unclear: What if canonical is stale vs GitHub?
   - Recommendation: base_version in payload identifies expected state, PR will show conflicts

4. **Strict vs Lenient Datatype Validation**
   - What we know: SemanticMediaWiki has 18 datatypes
   - What's unclear: Should we allow custom/extension datatypes?
   - Recommendation: Start strict with known 18, allow warning-only mode for unknowns

## Sources

### Primary (HIGH confidence)
- [Python graphlib documentation](https://docs.python.org/3/library/graphlib.html) - TopologicalSorter, CycleError
- [Semantic Versioning 2.0.0](https://semver.org/) - MAJOR/MINOR/PATCH rules
- [SemanticMediaWiki datatypes](https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes) - 18 valid datatypes
- Existing codebase: draft models, diff service, inheritance service

### Secondary (MEDIUM confidence)
- [SchemaVer for semantic versioning of schemas](https://snowplow.io/blog/introducing-schemaver-for-semantic-versioning-of-schemas) - MODEL/REVISION/ADDITION concept
- [GeeksforGeeks - Cycle detection with topological sort](https://www.geeksforgeeks.org/dsa/detect-cycle-in-directed-graph-using-topological-sort/) - Algorithm explanation
- [InfoQ - Breaking changes are broken](https://www.infoq.com/articles/breaking-changes-are-broken-semver/) - Modern SemVer challenges

### Tertiary (LOW confidence)
- Community patterns for validation UI display
- Various multi-severity validation approaches

## Metadata

**Confidence breakdown:**
- Reference validation: HIGH - Straightforward set membership checks
- Circular inheritance: HIGH - graphlib stdlib provides exactly what we need
- Datatype validation: HIGH - SemanticMediaWiki has documented list
- Breaking change detection: MEDIUM - SchemaVer concepts adapted, may need tuning
- Semver classification: MEDIUM - Logic is clear, edge cases may emerge
- UI integration: HIGH - Extends existing patterns

**Research date:** 2026-01-22
**Valid until:** ~60 days for validation logic (stable domain), ~30 days for UI patterns
