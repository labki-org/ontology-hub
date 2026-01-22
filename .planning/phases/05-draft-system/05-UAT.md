---
status: complete
phase: 05-draft-system
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-01-22T17:50:00Z
updated: 2026-01-22T18:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Draft via API
expected: POST to /api/v1/drafts/ with JSON payload containing wiki_url, base_version, and entities returns a response with capability_url and diff_preview fields.
result: pass

### 2. Validation Error on Missing Fields
expected: POST to /api/v1/drafts/ without wiki_url or base_version returns 422 status with validation error details.
result: pass

### 3. Retrieve Draft Diff
expected: GET /api/v1/drafts/{token}/diff returns the stored diff_preview with categories, properties, subobjects sections.
result: pass

### 4. Capability URL Routing
expected: Navigating to /drafts#{token} in browser redirects to /draft/{token} and loads the draft review page.
result: pass

### 5. Draft Header Display
expected: Draft review page shows wiki URL (clickable), base version, status badge (pending), and expiration countdown (shows time remaining).
result: pass

### 6. Diff Viewer Groups by Type
expected: Draft diff viewer shows collapsible sections for Categories, Properties, Subobjects with added/modified/deleted groups.
result: pass

### 7. Inline Field Editing
expected: Clicking pencil icon on a field value enters edit mode with input field. Check saves, X cancels. Enter key saves for text fields.
result: pass
note: Fixed by enabling immer MapSet plugin (commit 241fa9d)

### 8. Unsaved Changes Indicator
expected: After editing a field value, "Unsaved changes" indicator appears (bottom-right or floating) with Save and Discard buttons.
result: pass

### 9. Discard Changes
expected: Clicking Discard button resets all edited fields to original values and hides unsaved changes indicator.
result: pass

### 10. Module Assignment for Categories
expected: New or modified categories show module assignment dropdown. Selecting a module adds it as a badge with X to remove.
result: pass
note: Fixed by enabling immer MapSet plugin (commit 241fa9d)

### 11. Inherited Module Display
expected: Properties and subobjects show inherited module membership as grayed badges with "(via category)" text instead of editable dropdown.
result: skipped
reason: Test draft doesn't include properties/subobjects tied to new categories. Feature exists but not testable with current data.

### 12. Missing Dependency Warning
expected: Assigning a category to a module that has dependencies without also including those dependencies shows a red warning message about missing deps.
result: pass
note: Works as implemented (module-level deps). User feedback - should warn about entity-level deps (parent categories, properties, subobjects) instead. Logged as design refinement.

### 13. Bulk Module Assignment
expected: When draft has multiple new categories, bulk assignment section appears with checkbox list and "Assign Selected to Module" dropdown.
result: pass

### 14. Profile Editor
expected: Profile section shows existing profiles with their module lists. Each profile has checkboxes to add/remove modules. "Create New Profile" option available.
result: pass

### 15. Save Changes
expected: Clicking Save Changes button sends PATCH request to backend. On success, shows success toast and clears unsaved changes indicator.
result: pass

## Summary

total: 15
passed: 13
issues: 0
pending: 0
skipped: 2

## Gaps

[none - all issues resolved]

## Design Feedback

### Dependency Warning Logic (Test 12)
Current: Warns about module-to-module dependencies when assigning category to module.
Suggested: Should warn about entity-level dependencies instead:
- Parent category not in module (or dep module)
- Used properties not accessible
- Used subobjects not accessible

This is a design refinement, not a bug. Consider for future iteration.
