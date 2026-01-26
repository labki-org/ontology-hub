# Development Notes for Claude

This file contains important development notes, gotchas, and patterns that have caused issues in the past.

## JSON Patch Operations (RFC 6902)

### CRITICAL: "replace" vs "add" for Object Members

**Problem**: Using `"op": "replace"` on a path that doesn't exist will FAIL with `JsonPatchConflict`.

**Solution**: Use `"op": "add"` when the field might not exist. For object members (not array elements), "add" will:
- Create the field if it doesn't exist
- Replace the value if it does exist

**Example of the bug**:
```python
canonical = {'categories': ['A'], 'properties': ['P1']}  # Note: no 'templates' field!

# This FAILS because 'templates' doesn't exist:
patch = [{"op": "replace", "path": "/templates", "value": []}]

# This WORKS:
patch = [{"op": "add", "path": "/templates", "value": []}]
```

**Where this has bitten us**:
1. `auto_populate_module_derived()` in `draft_changes.py` - When adding derived entity patches (`/properties`, `/subobjects`, `/templates`), the canonical module JSON might not have all these fields.

2. Any code that creates patches for fields that may or may not exist in the canonical data.

**Rule of thumb**:
- Use `"add"` when setting a value on a field that might not exist
- Use `"replace"` only when you're certain the field exists
- Use `"remove"` to delete a field (also fails if field doesn't exist)

### Testing Patches

When debugging patch issues, test directly:
```python
import jsonpatch
canonical = {...}  # your canonical data
patch_ops = [...]  # your patch operations
try:
    result = jsonpatch.JsonPatch(patch_ops).apply(canonical)
    print('Success:', result)
except jsonpatch.JsonPatchException as e:
    print('FAILED:', e)
```

## Draft Overlay System

### How Draft Changes Are Applied

1. `DraftOverlayService.apply_overlay()` applies draft patches to canonical data
2. For UPDATE changes, the patch is applied to `canonical_json`
3. If the patch fails, it falls back to canonical data with `_patch_error` marker
4. The frontend receives the **effective state** (canonical + patch merged), not raw patch

### When Computing Effective State from Patches

If you need to compute effective values from a patch that contains multiple operations (some of which might fail), extract only the relevant operations:

```python
# Bad: Apply full patch (might fail on unrelated operations)
patch = jsonpatch.JsonPatch(change.patch)
effective = patch.apply(canonical)

# Good: Extract only the operations you need
relevant_patches = [op for op in change.patch if op.get("path", "").startswith("/categories")]
patch = jsonpatch.JsonPatch(relevant_patches)
effective = patch.apply(canonical)
```

## Module Derived Entities

Modules have two types of members:
- **Manual**: `categories`, `dependencies` (explicitly set by user)
- **Derived**: `properties`, `subobjects`, `templates` (auto-computed from categories)

When a module's categories change, `auto_populate_module_derived()` automatically computes and adds the derived entities to the draft patch.
