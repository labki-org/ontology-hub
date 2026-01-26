# Phase 22: Entity Lifecycle Bug Fixes - Research

**Researched:** 2026-01-25
**Domain:** Frontend query invalidation, backend draft change handling, graph query logic
**Confidence:** HIGH

## Summary

This research investigates two bugs blocking complete entity lifecycle support:
- **BUG-001**: Graph doesn't update when new entities are created
- **BUG-002**: Cannot delete entities created in the current draft session

Both bugs stem from incomplete integration between entity mutations and the graph visualization system. BUG-001 is a frontend cache invalidation gap. BUG-002 has two root causes: frontend dependency checking against stale graph data, and backend logic that incorrectly replaces CREATE with DELETE instead of removing the CREATE entirely.

**Primary recommendation:** Fix query invalidation for graph data after entity creation, and fix backend to remove CREATE changes when deleting draft-created entities.

## BUG-001: Graph Doesn't Update on Entity Creation

### Root Cause Analysis

**Confidence:** HIGH (verified by code inspection)

The issue is a missing cache invalidation in `useCreateEntityChange`:

**File:** `frontend/src/api/draftApiV2.ts` (lines 201-218)

```typescript
export function useCreateEntityChange(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateEntityParams) => createEntityChange(token!, params),
    onSuccess: () => {
      // Invalidate draft query to refresh status
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', token] })
      // Invalidate draft changes and entity lists to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes', token] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'properties'] })
      // ... other entity types
      // MISSING: No invalidation for graph queries!
    },
  })
}
```

The graph query uses a different query key:

**File:** `frontend/src/api/graph.ts` (line 20)

```typescript
queryKey: ['graph', 'neighborhood', entityKey, entityType, depth, draftId],
```

**Root cause:** `useCreateEntityChange.onSuccess` invalidates entity list caches (`['v2', 'categories']`, etc.) but does NOT invalidate graph query caches (`['graph', ...]`).

### Additional Issue: Isolated Draft-Created Entities (GRAPH-05)

**Confidence:** HIGH (verified by code inspection)

For newly created entities with no relationships (isolated nodes), there's a second issue in the backend graph query:

**File:** `backend/app/services/graph_query.py` (lines 72-156)

The CTE query (lines 90-137) queries the `categories` table directly:
```sql
start_cat AS (
    SELECT c.id, c.entity_key, c.label
    FROM categories c WHERE c.entity_key = :entity_key
),
```

For draft-created entities:
1. `start_category` is None (entity not in database)
2. Code checks for draft match (lines 77-85) - if found, continues
3. CTE query runs but returns NO rows (entity doesn't exist in `categories` table)
4. `entity_keys` list is empty (line 145)
5. Logic to add draft-created nodes (lines 191-204) checks `if draft_key in entity_keys` - fails because list is empty

**Result:** Graph view shows "No graph data" for isolated draft-created entities.

### Fix Approach

**Part 1: Frontend Query Invalidation**

In `useCreateEntityChange.onSuccess`, add:
```typescript
queryClient.invalidateQueries({ queryKey: ['graph'] })
```

This invalidates all graph queries, ensuring the neighborhood graph refetches with draft context.

**Part 2: Backend Isolated Node Support (GRAPH-05)**

Modify `get_neighborhood_graph` to handle draft-created entities as the starting node when the CTE returns empty:

1. After CTE query, check if `rows` is empty AND entity exists in `draft_creates`
2. If so, manually add the draft-created entity as the sole node
3. Check if draft entity has parents - if so, query their neighborhoods

**Files to Modify:**
- `frontend/src/api/draftApiV2.ts` - Add graph cache invalidation
- `backend/app/services/graph_query.py` - Handle isolated draft nodes

## BUG-002: Cannot Delete Newly Created Entities

### Root Cause Analysis

**Confidence:** HIGH (verified by code inspection)

This bug has **two related root causes**:

#### Frontend Issue: Stale Graph Data for Dependency Check

**File:** `frontend/src/components/layout/SidebarV2.tsx` (lines 233-234, 341)

```typescript
const graphNodes = useGraphStore((s) => s.nodes)
const graphEdges = useGraphStore((s) => s.edges)
// ...
const { canDelete: allowed, dependents } = canDelete(entityKey, graphNodes, graphEdges)
```

The dependency checker uses graph data from `graphStore`, which only contains the currently displayed graph neighborhood. For newly created entities:

1. If the graph is showing a different entity's neighborhood, the new entity isn't in `graphNodes`/`graphEdges`
2. Due to BUG-001, even if the new entity should be in the graph, it won't be until refresh

**Result:** `canDelete` returns `{ canDelete: true, dependents: [] }` because it's checking against empty/stale data.

However, this should still allow delete to proceed. The "failure" is on the backend.

#### Backend Issue: CREATE->DELETE Replacement Logic

**File:** `backend/app/routers/draft_changes.py` (lines 263-268)

```python
elif existing_change:
    # For CREATE/DELETE, replace the existing change entirely
    existing_change.change_type = change_in.change_type
    existing_change.patch = change_in.patch
    existing_change.replacement_json = change_in.replacement_json
    change = existing_change
```

When a DELETE is requested for an entity with an existing CREATE change, the code REPLACES the CREATE with DELETE. This is incorrect:

1. User creates entity X (CREATE change stored)
2. User deletes entity X (DELETE change sent)
3. Backend replaces CREATE with DELETE
4. Result: DELETE change for an entity that doesn't exist in canonical

**Correct behavior:** When deleting a draft-created entity, the CREATE change should be REMOVED entirely (the entity never existed, so there's nothing to delete from canonical).

### Fix Approach

**Part 1: Backend Change Handling**

In `add_draft_change`, add special handling for DELETE of draft-created entities:

```python
if change_in.change_type == ChangeType.DELETE:
    if existing_change and existing_change.change_type == ChangeType.CREATE:
        # Deleting a draft-created entity - remove the CREATE change entirely
        await session.delete(existing_change)
        await session.commit()
        # Return a 204 No Content or special response indicating removal
        return ...
```

**Part 2: Frontend - Consider Server-Side Dependency Check (Optional)**

The current frontend dependency check relies on potentially stale graph data. For robustness, consider:
- Adding a backend endpoint for dependency checking
- Or invalidating graph data more aggressively after any draft change

**Files to Modify:**
- `backend/app/routers/draft_changes.py` - Fix CREATE->DELETE handling

## Code Paths Summary

### Entity Creation Flow

```
SidebarV2.tsx
  -> handleCreateSubmit()
  -> createEntity.mutateAsync() [useCreateEntityChange]
  -> POST /api/v2/drafts/{token}/changes (change_type: CREATE)
  -> onSuccess: invalidate entity lists (NOT graph)
  -> Sidebar refreshes, Graph stale
```

### Graph Query Flow

```
GraphCanvas.tsx
  -> useNeighborhoodGraph(entityKey, ..., draftId)
  -> GET /api/v2/graph/neighborhood?entity_key=X&draft_id=Y
  -> graph_query.py:get_neighborhood_graph()
  -> CTE query + draft overlay
  -> Returns nodes/edges
  -> setGraphData() syncs to graphStore
```

### Entity Deletion Flow

```
SidebarV2.tsx
  -> handleDelete(entityType, entityKey, label)
  -> canDelete(entityKey, graphNodes, graphEdges) [uses graphStore]
  -> If allowed: deleteEntity.mutateAsync()
  -> POST /api/v2/drafts/{token}/changes (change_type: DELETE)
  -> Backend: If existing CREATE, replaces with DELETE (BUG!)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query invalidation | Custom cache management | React Query invalidateQueries | Built-in, reliable, handles race conditions |
| Dependency checking | Custom server endpoint | Fix graph invalidation first | Simpler fix, existing infrastructure |

## Common Pitfalls

### Pitfall 1: Partial Query Invalidation
**What goes wrong:** Invalidating some caches but not others leads to UI inconsistency
**Why it happens:** Different queries use different query keys
**How to avoid:** Use broad invalidation patterns like `['graph']` to catch all related queries
**Warning signs:** UI shows stale data in some views but not others

### Pitfall 2: Assuming Graph Data is Current
**What goes wrong:** Making decisions based on stale graphStore data
**Why it happens:** graphStore only updates when GraphCanvas mounts and fetches
**How to avoid:** For critical operations (delete), consider refetching or server-side validation
**Warning signs:** Operations that work after refresh but not before

### Pitfall 3: Draft-Canonical Confusion
**What goes wrong:** Treating draft-created entities like canonical entities
**Why it happens:** Backend logic doesn't differentiate between entity origins
**How to avoid:** Always check if entity exists only in draft before applying canonical operations
**Warning signs:** DELETE changes for non-existent entities, validation errors during PR

## Verification Criteria

### BUG-001 Fixed When:
1. Create new category via "+ New" button
2. Graph immediately shows the new category (no refresh needed)
3. New category appears with "added" badge in graph view
4. Works for isolated entities (no parents) - shows single node

### BUG-002 Fixed When:
1. Create new entity in draft mode
2. Click delete on the newly created entity
3. Entity is removed from sidebar
4. Draft changes list no longer shows the CREATE (change was removed, not converted to DELETE)
5. No errors in console or API responses

## Files to Modify

### For BUG-001:
| File | Change | Lines |
|------|--------|-------|
| `frontend/src/api/draftApiV2.ts` | Add graph query invalidation in onSuccess | ~217 |
| `backend/app/services/graph_query.py` | Handle isolated draft-created entities | ~145-157 |

### For BUG-002:
| File | Change | Lines |
|------|--------|-------|
| `backend/app/routers/draft_changes.py` | Remove CREATE when DELETE requested for draft-created entity | ~263-268 |

## Sources

### Primary (HIGH confidence)
- `frontend/src/api/draftApiV2.ts` - useCreateEntityChange mutation and invalidation
- `frontend/src/api/graph.ts` - Graph query key structure
- `frontend/src/components/graph/GraphCanvas.tsx` - Graph data flow
- `frontend/src/components/layout/SidebarV2.tsx` - Delete handling and dependency check
- `frontend/src/lib/dependencyChecker.ts` - canDelete implementation
- `frontend/src/stores/graphStore.ts` - Graph state management
- `backend/app/services/graph_query.py` - Neighborhood graph CTE logic
- `backend/app/routers/draft_changes.py` - Draft change creation and replacement logic
- `.planning/v2.1-MILESTONE-AUDIT.md` - Bug descriptions and context

## Metadata

**Confidence breakdown:**
- BUG-001 root cause: HIGH - verified by tracing query keys and invalidation
- BUG-001 fix approach: HIGH - standard React Query pattern
- BUG-002 root cause (backend): HIGH - verified by reading change handling logic
- BUG-002 fix approach: HIGH - clear logic change needed
- GRAPH-05 root cause: HIGH - verified by reading CTE query logic

**Research date:** 2026-01-25
**Valid until:** No expiration - this is codebase-specific research
