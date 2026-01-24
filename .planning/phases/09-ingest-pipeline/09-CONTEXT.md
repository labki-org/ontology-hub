# Phase 9: Ingest Pipeline - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate v2.0 schema from labki-schemas repo via webhook, replacing previous data with latest. Parse all entity types, populate canonical tables, refresh relationship tables and materialized views. Handle draft staleness when canonical updates.

</domain>

<decisions>
## Implementation Decisions

### Trigger & scheduling
- Webhook from GitHub push triggers ingest automatically
- Manual re-ingest available via UI button (admin function)
- Process each push individually — no debouncing, later ingests overwrite earlier ones
- GitHub signature verification required on webhook endpoint (X-Hub-Signature)

### Draft rebase behavior
- When new canonical is ingested, in-progress drafts are marked as "stale" (needs rebase)
- No automatic rebase — user must manually trigger rebase
- Stale drafts blocked from PR submission until rebased
- Rebase shows conflicts if detected; user must resolve before continuing

### Claude's Discretion
- Retry strategy for transient failures (network errors, rate limits)
- Conflict detection granularity (entity-level vs field-level)
- Conflict resolution behavior (block vs auto-resolve)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for webhook handling and ingest pipelines.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-ingest-pipeline*
*Context gathered: 2026-01-23*
