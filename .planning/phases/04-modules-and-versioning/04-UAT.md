---
status: complete
phase: 04-modules-and-versioning
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-01-22T06:15:00Z
updated: 2026-01-22T15:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Modules List Page
expected: Navigate to /modules. Page shows grid of module cards with name, entity count, and preview badges. Search input is available at the top.
result: pass

### 2. Module Detail Page
expected: Click any module card. Page shows module name, description, dependency badges (if any), and entities grouped into collapsible Categories/Properties/Subobjects sections.
result: pass

### 3. Profiles List Page
expected: Navigate to /profiles. Page shows grid of profile cards with name, module count, and module preview badges.
result: pass

### 4. Profile Detail Page
expected: Click any profile card. Page shows profile name, description, included modules as smaller cards, and entity summary counts.
result: pass

### 5. Sidebar Navigation
expected: Sidebar shows Modules and Profiles links above the entity type sections (Categories, Properties, Subobjects). Clicking navigates to respective pages.
result: pass

### 6. Module Dependency Graph on Profile Page
expected: On a profile detail page (if modules have dependencies), see a "Module Dependencies" section with a React Flow graph showing modules as nodes with arrows indicating dependencies.
result: pass

### 7. Entity Overlap Indicator
expected: On a module detail page, if any entities appear in multiple modules, see neutral blue/gray "also in: Module X, Module Y" indicators next to those entities.
result: pass

### 8. Versions Page
expected: Navigate to /versions. Page shows list of releases with dates and version labels. Two dropdowns allow selecting versions to compare.
result: skipped
reason: No GitHub releases exist in the labki-schemas repo yet

### 9. Version Diff Display
expected: With two versions selected, DiffViewer shows changes grouped by entity type (Categories, Properties, Subobjects, Modules, Profiles). Each group has added (green), modified (yellow), deleted (red) sections.
result: skipped
reason: No GitHub releases exist in the labki-schemas repo yet

### 10. Default Version Comparison
expected: When landing on /versions, the comparison defaults to latest release vs previous release (if at least 2 releases exist).
result: skipped
reason: No GitHub releases exist in the labki-schemas repo yet

## Summary

total: 10
passed: 7
issues: 0
pending: 0
skipped: 3

## Gaps

[none yet]
