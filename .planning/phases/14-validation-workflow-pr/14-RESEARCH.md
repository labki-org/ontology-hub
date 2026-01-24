# Phase 14: Validation + Workflow + PR - Research

**Researched:** 2026-01-24
**Domain:** Validation engine, draft workflow state machine, GitHub PR submission
**Confidence:** HIGH

## Summary

Phase 14 completes the v2.0 draft system by connecting the existing validation infrastructure (v1.0) to the v2.0 draft change model, implementing the full workflow state machine (Draft -> Validated -> Submitted -> Merged), and enabling PR creation with the existing OAuth flow.

The codebase already contains substantial v1.0 infrastructure that can be adapted:
- Validation engine with reference checks, circular inheritance detection, breaking change detection, and semver suggestions (backend/app/services/validation/)
- OAuth flow with GitHub authentication and PR creation (backend/app/routers/oauth.py, backend/app/services/github.py)
- PR builder with file serialization and body generation (backend/app/services/pr_builder.py)
- Frontend components: DraftBanner, ValidationSummary, DraftDiffViewer, OpenPRButton

**Primary recommendation:** Adapt v1.0 validation infrastructure to work with v2.0 DraftChange model, implement workflow state transitions with auto-revert on edit, and build wizard-style PR submission UI using existing Radix Dialog component.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonpatch | existing | RFC 6902 JSON Patch validation | Already used in draft_overlay.py |
| graphlib | stdlib | Cycle detection in inheritance | Already in validation/inheritance.py |
| httpx | existing | GitHub API client | Already configured with retry logic |
| authlib | existing | OAuth 2.0 flow | Already in routers/oauth.py |
| @radix-ui/react-dialog | ^1.1.15 | Modal dialogs for wizard | Already in package.json |
| zustand | ^5.0.10 | State management | Already used for draftStore |
| react-hook-form | ^7.71.1 | Form handling in wizard | Already in package.json |
| zod | ^4.3.5 | Schema validation | Already in package.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons for status/steps | Already available |
| immer | ^11.1.3 | Immutable state updates | Already in draftStore |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multi-step Dialog | react-wizard-primitive | Adds dependency, Dialog + state is simpler |
| Custom validation | ajv for JSON Schema | Over-engineered for specific entity checks |

**Installation:** No new dependencies required. Existing stack covers all needs.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── validation/
│   │   ├── validator.py       # Existing orchestrator, adapt for v2
│   │   ├── reference.py       # Adapt for DraftChange model
│   │   ├── inheritance.py     # Existing, works with any parent map
│   │   ├── breaking.py        # Adapt for DraftChange model
│   │   ├── semver.py          # Existing, no changes needed
│   │   ├── datatype.py        # Existing, no changes needed
│   │   └── schema.py          # NEW: JSON Schema validation
│   ├── pr_builder_v2.py       # NEW: Adapt for DraftChange model
│   └── draft_workflow.py      # NEW: State machine logic
├── routers/
│   └── drafts_v2.py           # Add validate and submit endpoints
└── schemas/
    └── validation.py          # Existing, update for entity_key

frontend/src/
├── components/
│   └── draft/
│       ├── DraftBanner.tsx        # Update for v2 workflow states
│       ├── ValidationSummary.tsx  # Existing, minor updates
│       ├── DraftDiffViewer.tsx    # Existing, works as-is
│       ├── FloatingActionBar.tsx  # NEW: Sticky validate/submit
│       ├── PRWizard.tsx           # NEW: Multi-step submission
│       └── PRWizardSteps/
│           ├── ReviewChanges.tsx  # Step 1: Show diff summary
│           ├── EditDetails.tsx    # Step 2: PR title + user comment
│           └── ConfirmSubmit.tsx  # Step 3: Final confirmation
├── stores/
│   └── draftStore.ts              # Add workflow state, validation results
└── api/
    └── draftsV2.ts                # Add validation/submit mutations
```

### Pattern 1: Workflow State Machine
**What:** Draft status transitions with validation and auto-revert
**When to use:** Managing draft lifecycle from creation to PR merge

The v2 Draft model already has DraftStatus enum (DRAFT, VALIDATED, SUBMITTED, MERGED, REJECTED).

```python
# State transitions (from existing drafts_v2.py)
VALID_TRANSITIONS = {
    DraftStatus.DRAFT: {DraftStatus.VALIDATED},
    DraftStatus.VALIDATED: {DraftStatus.SUBMITTED, DraftStatus.DRAFT},
    DraftStatus.SUBMITTED: {DraftStatus.MERGED, DraftStatus.REJECTED},
    DraftStatus.MERGED: set(),   # Terminal
    DraftStatus.REJECTED: set(), # Terminal
}

# Auto-revert on edit (new logic)
async def add_draft_change(...):
    # If draft is VALIDATED, auto-revert to DRAFT
    if draft.status == DraftStatus.VALIDATED:
        draft.status = DraftStatus.DRAFT
        draft.validated_at = None
```

### Pattern 2: Validation Pipeline for v2
**What:** Reconstruct "effective" entity state from DraftChanges, then validate
**When to use:** Before transitioning DRAFT -> VALIDATED

```python
async def validate_draft_v2(
    draft_id: UUID,
    session: AsyncSession,
) -> DraftValidationReport:
    """Validate draft by reconstructing effective entities from changes."""

    # 1. Load all draft changes
    changes = await session.execute(
        select(DraftChange).where(DraftChange.draft_id == draft_id)
    )

    # 2. Reconstruct effective state (like draft_overlay.py does)
    effective_entities = await build_effective_entities(changes, session)

    # 3. Run validation checks against effective state
    results = []
    results.extend(await check_references_v2(effective_entities, session))
    results.extend(await check_circular_inheritance(effective_entities, session))
    results.extend(check_datatypes_v2(effective_entities))
    results.extend(await detect_breaking_changes_v2(effective_entities, session))

    # 4. Compute semver suggestion
    ...
```

### Pattern 3: Wizard Dialog with Steps
**What:** Multi-step modal using Radix Dialog + local state
**When to use:** PR submission flow

```tsx
// Using existing Dialog component with step state
function PRWizard({ open, onOpenChange, draftId }: PRWizardProps) {
  const [step, setStep] = useState<'review' | 'details' | 'confirm'>('review')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === 'review' && (
          <ReviewChangesStep
            onNext={() => setStep('details')}
          />
        )}
        {step === 'details' && (
          <EditDetailsStep
            onBack={() => setStep('review')}
            onNext={() => setStep('confirm')}
          />
        )}
        {step === 'confirm' && (
          <ConfirmSubmitStep
            onBack={() => setStep('details')}
            onSubmit={handleSubmit}
          />
        )}

        {/* Step indicator */}
        <StepProgress current={step} steps={['review', 'details', 'confirm']} />
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern 4: Floating Action Bar
**What:** Fixed position bar with validate/submit buttons
**When to use:** Providing consistent access to actions regardless of scroll

```tsx
function FloatingActionBar({ draft, validationStatus }: FloatingActionBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <Card className="flex items-center gap-4 px-4 py-2 shadow-lg">
        <Badge variant={...}>{draft.status}</Badge>

        <Button
          onClick={onValidate}
          disabled={draft.status !== 'draft'}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Validate
        </Button>

        <Button
          onClick={() => setWizardOpen(true)}
          disabled={draft.status !== 'validated'}
        >
          <GitPullRequest className="h-4 w-4 mr-2" />
          Submit PR
        </Button>
      </Card>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Storing OAuth tokens in database:** Tokens are session-only, never persisted (existing pattern)
- **Validating on every keystroke:** Use debounce or explicit validate button
- **Blocking on warnings:** Only errors should prevent submission
- **Deep cloning entire canonical for validation:** Use targeted queries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Graph traversal | graphlib.TopologicalSorter | Provides cycle path in error |
| JSON Patch application | Manual merge | jsonpatch library | RFC 6902 compliant |
| GitHub PR creation | Direct API calls | GitHubClient.create_pr_with_token | Has retry, rate limit handling |
| OAuth flow | Custom implementation | authlib OAuth | Handles token exchange securely |
| Form validation | Manual checks | react-hook-form + zod | Type-safe, declarative |
| Modal dialogs | Custom portal | Radix Dialog | Accessible, animated |

**Key insight:** The v1.0 codebase solved most of these problems already. Adapt rather than rebuild.

## Common Pitfalls

### Pitfall 1: v1 vs v2 Draft Model Mismatch
**What goes wrong:** Validation code expects v1 DraftPayload format, but v2 uses DraftChange records
**Why it happens:** v1 stored entire payload in draft.payload JSON; v2 stores granular changes in draft_change table
**How to avoid:** Create adapter function that reconstructs "effective entities" from DraftChanges before validation
**Warning signs:** ValidationResult references fields that don't exist in DraftChange

### Pitfall 2: OAuth Session Loss
**What goes wrong:** After GitHub redirect, session is empty
**Why it happens:** Cross-origin issues, SameSite cookies, or session middleware misconfiguration
**How to avoid:** Keep existing SessionMiddleware configuration; test OAuth flow end-to-end
**Warning signs:** "No pending draft found" error after GitHub authorization

### Pitfall 3: Status Transition Race Conditions
**What goes wrong:** Two concurrent requests both try to transition DRAFT -> VALIDATED
**Why it happens:** No locking on status transitions
**How to avoid:** Use SELECT ... FOR UPDATE when reading draft for status change
**Warning signs:** Database integrity errors, duplicate validation runs

### Pitfall 4: Auto-Revert Losing Validation Results
**What goes wrong:** User edits after validation, status reverts, but old validation results still shown
**Why it happens:** Frontend cached stale validation results
**How to avoid:** Invalidate validation query cache when any draft change is added
**Warning signs:** UI shows "Validated" badge but status is DRAFT

### Pitfall 5: PR Submission Without Revalidation
**What goes wrong:** User validates, waits, canonical changes, submits PR with stale validation
**Why it happens:** Validation was against old canonical state
**How to avoid:** Re-validate at submission time if rebase_status indicates changes
**Warning signs:** PR contains changes that conflict with current main branch

## Code Examples

Verified patterns from existing codebase:

### Validation Result Schema (from schemas/validation.py)
```python
class ValidationResult(BaseModel):
    """Single validation finding with entity context."""
    entity_type: Literal["category", "property", "subobject", "module", "bundle", "template"]
    entity_id: str  # Note: v2 uses entity_key, update field name
    field: Optional[str] = None
    code: str  # "MISSING_PARENT", "CIRCULAR_INHERITANCE", etc.
    message: str
    severity: Literal["error", "warning", "info"]
    suggested_semver: Optional[Literal["major", "minor", "patch"]] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
```

### OAuth Login Initiation (from routers/oauth.py)
```python
@router.get("/github/login")
async def github_login(request: Request, draft_token: str):
    """Initiate GitHub OAuth flow for PR creation."""
    # Store draft_token in session
    request.session["pending_draft_token"] = draft_token
    request.session["oauth_initiated_at"] = datetime.utcnow().isoformat()

    redirect_uri = request.url_for("github_callback")
    return await oauth.github.authorize_redirect(request, redirect_uri)
```

### PR File Generation (from services/pr_builder.py)
```python
def build_files_from_draft(payload: DraftPayload) -> list[dict]:
    """Build list of files from draft payload for PR creation.

    Returns:
        List of dicts with "path" and "content" keys for Git tree creation.
        Deletion entries have "path" and "delete": True instead of "content".
    """
    files = []
    for category in payload.entities.categories:
        repo_entity = serialize_entity_for_repo(category, "categories")
        content = json.dumps(repo_entity, indent=2) + "\n"
        files.append({"path": f"categories/{category.entity_id}.json", "content": content})
    # ... similar for other entity types
    return files
```

### GitHub PR Creation (from services/github.py)
```python
async def create_pr_with_token(
    self,
    token: str,
    owner: str,
    repo: str,
    branch_name: str,
    files: list[dict],
    commit_message: str,
    pr_title: str,
    pr_body: str,
    base_branch: str = "main",
) -> str:
    """Create a PR with user's OAuth token (full atomic workflow)."""
    async with httpx.AsyncClient(...) as client:
        temp_client = GitHubClient(client)

        # 1. Get latest commit SHA from base branch
        base_sha = await temp_client.get_branch_sha(owner, repo, base_branch)

        # 2-5. Create tree, commit, branch
        # ...

        # 6. Create pull request
        pr = await temp_client.create_pull_request(
            owner, repo, pr_title, pr_body, branch_name, base_branch
        )
        return pr["html_url"]
```

### Draft Validation Hook (frontend pattern)
```tsx
// Using existing TanStack Query pattern
function useValidateDraft(draftId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v2/drafts/${draftId}/validate`, {
        method: 'POST',
      })
      return response.json()
    },
    onSuccess: (data) => {
      // Update draft status in store
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] })
    },
  })
}
```

## State of the Art

| Old Approach (v1) | Current Approach (v2) | When Changed | Impact |
|-------------------|----------------------|--------------|--------|
| Monolithic DraftPayload JSON | Granular DraftChange records | v2.0 | Enables auto-rebase, better diffs |
| profiles entity type | bundles entity type | v2.0 | Naming consistency |
| Draft.payload field | draft_change table | v2.0 | Validation must reconstruct effective state |
| entity_id field | entity_key field | v2.0 | Path-based identification |

**Deprecated/outdated:**
- `mark_drafts_stale()`: Replaced by `auto_rebase_drafts()` (kept for backward compat)
- v1 validation service working on DraftPayload: Must adapt for DraftChange model

## Open Questions

Things that couldn't be fully resolved:

1. **JSON Schema Validation Source**
   - What we know: Requirements mention "_schema.json files from canonical repo"
   - What's unclear: Are these fetched from GitHub or stored in database during ingest?
   - Recommendation: Ingest _schema.json files into database during sync; validate against stored schemas

2. **Webhook for Merged Status**
   - What we know: CONTEXT.md says "Merged status tracked via GitHub webhook"
   - What's unclear: Is this PR merge webhook already implemented?
   - Recommendation: Extend existing webhooks.py to handle pull_request events with action=closed, merged=true

3. **Branch Naming Convention**
   - What we know: pr_builder.py uses `draft-{uuid_prefix}-{timestamp}`
   - What's unclear: CONTEXT.md leaves this to Claude's discretion
   - Recommendation: Keep existing pattern; it's unique and sortable

## Sources

### Primary (HIGH confidence)
- Existing codebase files reviewed:
  - backend/app/services/validation/* (all validators)
  - backend/app/routers/oauth.py (OAuth flow)
  - backend/app/services/github.py (GitHub API)
  - backend/app/services/pr_builder.py (file serialization)
  - backend/app/models/v2/draft.py (DraftChange model)
  - backend/app/routers/drafts_v2.py (status transitions)
  - backend/app/services/draft_overlay.py (effective view computation)
  - frontend/src/components/draft/* (UI components)
  - frontend/src/stores/draftStore.ts (state management)

### Secondary (MEDIUM confidence)
- .planning/PROJECT.md for architectural context
- .planning/phases/14-validation-workflow-pr/14-CONTEXT.md for user decisions

### Tertiary (LOW confidence)
- None - all findings based on actual codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in codebase
- Architecture: HIGH - extending existing patterns
- Pitfalls: HIGH - based on actual code review and v1 implementation experience

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (stable patterns, internal codebase)
