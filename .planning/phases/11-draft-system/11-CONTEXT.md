# Phase 11: Draft System - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Store draft changes as JSON Patch deltas with server-side effective view computation and auto-rebase on canonical updates. MediaWiki push import creates draft_change rows from payload.

</domain>

<decisions>
## Implementation Decisions

### Patch storage & application
- RFC 6902 JSON Patch format for modified entities
- Patches overlay directly on canonical data — no conflict detection needed (single-version model)
- Validation runs on every save, not just on explicit validate action
- Invalid patches rejected immediately with error feedback

### New entity storage
- Claude's Discretion: Choose between full JSON storage or patch-against-empty-object, whichever integrates better with existing draft_change schema

### MediaWiki import mapping
- Match entities by entity_key (exact match required)
- MediaWiki must explicitly signal intent: new entity creation vs modification of existing
- Unknown entity_key without explicit "create" action is rejected (prevents ambiguity from typos)
- Each MediaWiki push creates a new draft (not appended to existing)

### MediaWiki payload structure
- Claude's Discretion: Design payload format that explicitly signals action type (create/modify/delete) per entity
- Document the expected payload schema for MediaWiki extension team to implement

### Claude's Discretion
- New entity storage format (full JSON vs patch against {})
- MediaWiki payload structure design
- Auto-rebase implementation details
- Localized re-materialization approach for inheritance changes

</decisions>

<specifics>
## Specific Ideas

- "We don't want any ambiguity from MW if an entity is a suggested new addition vs just a wrong naming of an already existing entity" — explicit action signals required
- MediaWiki extension hasn't implemented the push format yet — our documentation defines the contract

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-draft-system*
*Context gathered: 2026-01-24*
