---
type: summary
phase: 02
plan: 01
subsystem: github-integration
tags: [github-api, httpx, tenacity, indexer, upsert, postgresql]
dependency-graph:
  requires: [01-01, 01-02]
  provides: [github-client, indexer-service, sync-endpoint]
  affects: [02-02, 03-01]
tech-stack:
  added: [tenacity]
  patterns: [lifespan-managed-client, exponential-backoff, postgresql-upsert]
key-files:
  created:
    - backend/app/services/__init__.py
    - backend/app/services/github.py
    - backend/app/services/indexer.py
    - backend/alembic/versions/002_entity_unique_constraint.py
  modified:
    - backend/app/config.py
    - backend/app/models/entity.py
    - backend/app/main.py
    - backend/requirements.txt
    - .env.example
decisions:
  - decision: "GITHUB_TOKEN optional at startup"
    context: "Allow app to start without GitHub integration configured"
    rationale: "Better developer experience, sync endpoint returns 503 with guidance"
  - decision: "Store full schema_definition in entities"
    context: "Parse entity JSON files from GitHub"
    rationale: "Preserves all schema data for future use, flexible structure"
metrics:
  duration: 5 min
  completed: 2026-01-21
---

# Phase 2 Plan 1: GitHub API Client & Indexer Summary

**One-liner:** httpx AsyncClient with tenacity retry logic for GitHub API, indexer service with PostgreSQL ON CONFLICT DO UPDATE upserts, manual sync endpoint at /admin/sync

## What Was Built

### GitHub API Client (`backend/app/services/github.py`)
- `GitHubClient` class wrapping httpx AsyncClient for connection pooling
- `GitHubRateLimitError` exception for rate limit handling
- Exponential backoff with jitter using tenacity (1s-120s, 5 attempts max)
- Methods:
  - `get_repository_tree()` - Git Trees API with `?recursive=1`
  - `get_file_content()` - Fetch and base64-decode JSON files
  - `get_latest_commit_sha()` - Get HEAD commit for versioning
- Filters tree entries for `.json` files in entity directories

### Database Migration (`backend/alembic/versions/002_entity_unique_constraint.py`)
- Added `UNIQUE(entity_id, entity_type)` constraint named `uq_entities_entity_id_type`
- Enables atomic upsert with `ON CONFLICT DO UPDATE`
- Updated Entity model with `__table_args__` declaration

### Indexer Service (`backend/app/services/indexer.py`)
- `IndexerService` class for parsing and upserting entities
- Supports categories, properties, subobjects, modules, profiles
- PostgreSQL `insert().on_conflict_do_update()` for atomic upserts
- `sync_repository()` function for full repository indexing
- Returns sync stats: commit_sha, entities_synced, files_processed, errors
- Handles parse errors gracefully (logs warning, continues)

### App Integration (`backend/app/main.py`)
- httpx AsyncClient created in lifespan context manager
- Properly closed on shutdown
- `/admin/sync` POST endpoint for manual sync trigger
- Returns 503 with guidance if GITHUB_TOKEN not configured

### Configuration
- Added to `config.py`: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_WEBHOOK_SECRET
- Added tenacity to requirements.txt
- Updated .env.example with GitHub configuration section

## Key Patterns Used

1. **Lifespan-managed httpx client** - Single client for connection pooling, created at startup, closed at shutdown
2. **Tenacity exponential backoff** - Automatic retry on rate limits with jitter
3. **PostgreSQL upsert** - `insert().on_conflict_do_update()` for atomic entity sync
4. **Transaction-based sync** - All changes commit together or rollback

## Verification Results

- GitHub client imports and instantiates correctly
- Unique constraint `uq_entities_entity_id_type` exists in database
- `/admin/sync` endpoint visible in OpenAPI docs
- Without GITHUB_TOKEN: returns 503 with helpful message
- App starts and health check passes

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| GITHUB_TOKEN optional at startup | Better DX - app runs without GitHub, sync returns 503 |
| Store full schema_definition | Preserves all data, flexible for future use |
| tenacity for retry logic | Handles jitter, max attempts, logging better than manual |
| Named constraint `uq_entities_entity_id_type` | Required for explicit ON CONFLICT reference |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| d4827c1 | feat(02-01): add GitHub API client with rate limit handling |
| 1a358e0 | feat(02-01): add unique constraint for entity upsert support |
| 2954f2e | feat(02-01): add indexer service for repository sync |
| 28a9241 | feat(02-01): integrate GitHub client into app lifespan with sync endpoint |

## Next Phase Readiness

**Ready for 02-02** (Webhook endpoint):
- GitHubClient and IndexerService exported and available
- GITHUB_WEBHOOK_SECRET config in place
- Pattern for signature verification documented in research

**Blockers:** None

**Testing note:** Full end-to-end sync requires valid GITHUB_TOKEN and SemanticSchemas repository access. Without token, endpoint returns 503 as designed.
