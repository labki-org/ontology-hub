---
status: complete
phase: 06-validation-engine
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md]
started: 2026-01-22T22:30:00Z
updated: 2026-01-22T23:45:00Z
completed: 2026-01-22T23:45:00Z
---

## Current Test

[all tests complete]

## Tests

### 1. Missing Reference Detection
expected: Create a draft with a category referencing a non-existent parent. Draft creation returns validation_results with MISSING_PARENT error.
result: pass

### 2. Circular Inheritance Detection
expected: Create a draft where category A has parent B and category B has parent A. Validation reports CIRCULAR_INHERITANCE error with cycle path.
result: pass

### 3. Invalid Datatype Detection
expected: Create a draft with a property using an invalid datatype (e.g., "InvalidType"). Validation reports INVALID_DATATYPE error listing allowed types.
result: pass

### 4. Breaking Change Warning - Datatype Change
expected: Create a draft modifying an existing property's datatype (e.g., Text to Number). Validation reports DATATYPE_CHANGED warning with suggested_semver: major.
result: pass
notes: Fixed pluralization bug in breaking.py - `categorys`/`propertys` -> `categories`/`properties`

### 5. Breaking Change Warning - Cardinality Restriction
expected: Create a draft changing a property from multiple to single cardinality. Validation reports CARDINALITY_RESTRICTED warning with suggested_semver: major.
result: pass

### 6. Non-Breaking Change - Cardinality Relaxation
expected: Create a draft changing a property from single to multiple cardinality. Validation reports CARDINALITY_RELAXED info with suggested_semver: minor.
result: pass

### 7. New Entity Addition
expected: Create a draft adding a new category. Validation reports ENTITY_ADDED info with suggested_semver: minor.
result: pass

### 8. Semver Aggregation - Highest Severity
expected: Create a draft with both a datatype change (major) and a new entity (minor). Overall suggested_semver should be major.
result: pass

### 9. ValidationSummary Card Display
expected: Open a draft with validation results. See ValidationSummary card showing is_valid status with icon (check/alert), error/warning/info counts with collapsible sections.
result: pass
notes: Shows "Validation: Valid" with icon, "Warnings 1" and "Info 2" with collapsible sections

### 10. Semver Badge Display
expected: Open a draft with validation results. See semver badge (MAJOR red, MINOR blue, or PATCH green) in ValidationSummary header.
result: pass
notes: Shows "Suggested: MAJOR" badge in header

### 11. Semver Reasoning Display
expected: Open a draft with validation results. See "Semver reasoning" section listing why that semver level was suggested.
result: pass
notes: Shows "Semver reasoning:" with "DATATYPE_CHANGED: has_name (Text -> Number)"

### 12. Inline Validation Badges
expected: Open a draft with validation issues on specific entities. See validation badges inline next to those entities in the diff viewer.
result: pass
notes: Icons appear next to has_name in the diff viewer

### 13. Validation Badge Tooltip
expected: Hover over an inline validation badge. Tooltip shows full error code, message, and semver impact if applicable.
result: pass
notes: Tooltip shows DATATYPE_CHANGED, message, Text -> Number, and "Semver impact: major"

### 14. Validation Recomputes on Update
expected: Edit a draft (via PATCH) to fix a validation error. After save, validation_results should update to reflect the fix.
result: pass
notes: Fixed InvalidType->Text via PATCH; validation updated from is_valid:false to is_valid:true

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
