# Phase 3: Entity Browsing - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse, search, and explore entity relationships in a web UI. This phase delivers read-only entity pages, search, inheritance visualization, and used-by references. Draft editing and PR creation are separate phases (5 and 7).

</domain>

<decisions>
## Implementation Decisions

### Page layout
- Sidebar + main content structure
- Sidebar contains collapsible entity tree browser for navigation
- Main content shows entity details

### Schema display
- Parsed table view showing fields, types, constraints (not raw JSON/YAML)
- Structured presentation over raw schema files

### Category pages — property/subobject display
- Single unified list showing both declared and inherited properties/subobjects
- Visual indicators (badges/icons) distinguish declared vs inherited
- Inherited items show which category they come from
- Full inheritance chain shown (e.g., "from ParentA via GrandparentB")
- This is the most important section of a category page

### Inheritance visualization
- Interactive node graph (not tree — multiple inheritance requires graph structure)
- Expandable: start focused on current category + direct parents/children, click to expand
- Mini graph on entity detail page, link to dedicated full graph explorer page

### Used-by references
- Simple clickable list of categories that use a property/subobject
- Links navigate to the using category's page

### Claude's Discretion
- Information density and spacing
- Click behavior on graph nodes (navigate vs expand)
- Empty state designs
- Loading states and skeletons

</decisions>

<specifics>
## Specific Ideas

- Category pages need to show the full breadth of what a category includes — this view will eventually support editing in Phase 5
- Consider an inverted tree view from child to parents on category pages to support future editing workflow
- The browsing foundation should anticipate that users will need to see exactly what they're editing when drafts are created

</specifics>

<deferred>
## Deferred Ideas

- **Inline editing workflow** — Add property button, popup to create new entity, add to specific location (Phase 5: Draft System)
- **Edit scope limitation** — Only edit main category being viewed, show parents as read-only (Phase 5)
- **Draft creation from browse** — Creating update drafts from entity pages (Phase 5)
- **PR submission** — Submit drafted changes as GitHub PR (Phase 7)

</deferred>

---

*Phase: 03-entity-browsing*
*Context gathered: 2026-01-21*
