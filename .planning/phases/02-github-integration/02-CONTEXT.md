# Phase 2: GitHub Integration - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Index the SemanticSchemas GitHub repository and expose entity data via API. Includes fetching/parsing entity files, storing with commit SHA versioning, API endpoints for entity retrieval, and webhook handling for push events. Browsing UI and search are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Error & Edge Cases
- **Parse errors**: Skip unparseable files and log them; don't block sync for individual file failures
- **Rate limits**: Exponential backoff when GitHub API limits are hit; auto-retry until success
- **Partial failures**: Atomic updates per push — transaction-based, all changes succeed or rollback
- **GitHub unavailability**: Claude's discretion on resilience strategy (serve stale vs degrade gracefully)

### Claude's Discretion
- Indexing strategy (full vs incremental sync approach)
- API response format and pagination design
- Webhook verification and processing model (queue vs sync)
- Specific retry intervals and backoff parameters
- How to surface skipped/invalid files to admins
- Resilience behavior when GitHub is unreachable

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for GitHub API integration and entity storage.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-github-integration*
*Context gathered: 2026-01-20*
