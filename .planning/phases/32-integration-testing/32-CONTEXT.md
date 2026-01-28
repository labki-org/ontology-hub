# Phase 32: Integration Testing - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify end-to-end functionality of Dashboard and Resource entities across ingest, API, derivation, draft CRUD, and PR submission. Extend existing test patterns to cover new entity types.

</domain>

<decisions>
## Implementation Decisions

### Test patterns
- Both unit tests AND API integration tests — full coverage approach
- Unit tests for parsers, validators, derivation logic in isolation
- API tests for endpoints with database, extending existing test_*.py patterns

### Data approach
- Test fixtures only — no dependency on real labki-ontology repo state
- Create test dashboards/resources in fixtures for predictable testing
- Edge cases covered through fixture variation

### E2E scope
- Happy path only for this phase
- One flow: create dashboard in draft → verify API response → verify PR file structure
- Error cases and broader E2E coverage deferred to future milestones

### Regression handling
- Broken tests block phase completion
- Fix existing test failures immediately before moving on
- No deferred failures — all tests must pass

### Claude's Discretion
- Specific fixture structure and naming
- Test file organization within existing patterns
- Which derivation scenarios to cover in unit tests

</decisions>

<specifics>
## Specific Ideas

- "Find a middle ground where we aren't building out the entire remaining test suite right now"
- Extend approaches already established for Category, Module, Bundle, Template entities

</specifics>

<deferred>
## Deferred Ideas

- Comprehensive E2E test suite — future milestone
- Error case E2E tests (validation failures, edge cases)
- Real repo verification tests

</deferred>

---

*Phase: 32-integration-testing*
*Context gathered: 2026-01-28*
