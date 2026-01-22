# Phase 7: PR Integration - Research

**Researched:** 2026-01-22
**Domain:** GitHub OAuth, REST API, PR Creation Flow
**Confidence:** HIGH

## Summary

Phase 7 implements the final step in the draft workflow: creating GitHub PRs from validated drafts. This requires implementing GitHub OAuth (triggered only at PR submission time, not platform login), serializing draft entities to the repo file format, and using GitHub's Git Data API to create branches, commits, and pull requests.

The key architectural insight is that **the platform does NOT need persistent user accounts**. OAuth tokens can be held in memory during the PR creation flow and discarded immediately after. The existing capability-URL-based draft system remains stateless; GitHub OAuth is a transient operation that transforms a draft into a PR.

**Primary recommendation:** Use Authlib with Starlette SessionMiddleware for OAuth flow management, GitHub's Git Data API (trees/commits/refs) for atomic multi-file commits, and a stateless token handling approach where user tokens are never persisted.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Authlib | 1.6+ | OAuth 2.0 client | De facto Python OAuth library, Starlette/FastAPI support built-in |
| httpx | 0.27+ | GitHub API calls | Already in use, async-native, works well with Authlib |
| Starlette SessionMiddleware | (bundled) | Temporary OAuth state | Stores state/code during OAuth redirect flow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PyJWT | 2.8+ | Token introspection (optional) | Only if debugging token issues |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Authlib | python-social-auth | More features but heavier, overkill for single-provider OAuth |
| Authlib | httpx-oauth | Lighter but less mature, fewer examples |
| SessionMiddleware | Redis sessions | More complex, unnecessary for transient OAuth state |

**Installation:**
```bash
pip install authlib
```

Note: httpx and starlette are already dependencies via FastAPI.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── github.py              # Existing - extend for PR creation
│   ├── github_oauth.py        # NEW - OAuth flow management
│   └── pr_builder.py          # NEW - PR body formatting, file serialization
├── routers/
│   ├── oauth.py               # NEW - OAuth callback endpoints
│   └── drafts.py              # Extend with /drafts/{token}/pr endpoint
└── config.py                  # Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

frontend/src/
├── api/
│   └── oauth.ts               # NEW - OAuth initiation helpers
├── components/draft/
│   └── OpenPRButton.tsx       # NEW - Triggers OAuth + PR creation
└── pages/
    └── OAuthCallbackPage.tsx  # NEW - Handles OAuth redirect
```

### Pattern 1: Stateless OAuth Token Handling
**What:** User's GitHub access token is held in memory/session only during PR creation, never persisted to database
**When to use:** When you need user authentication for a single operation without creating platform accounts
**Example:**
```python
# Source: https://docs.authlib.org/en/latest/client/fastapi.html
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET)

oauth = OAuth()
oauth.register(
    name='github',
    client_id=settings.GITHUB_CLIENT_ID,
    client_secret=settings.GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'public_repo'},  # Or 'repo' for private repos
)

@router.get('/oauth/github')
async def github_login(request: Request, draft_token: str):
    """Initiate OAuth flow, storing draft token in session for callback."""
    request.session['pending_draft_token'] = draft_token
    redirect_uri = request.url_for('github_callback')
    return await oauth.github.authorize_redirect(request, redirect_uri)

@router.get('/oauth/callback')
async def github_callback(request: Request):
    """Exchange code for token, create PR, discard token."""
    token = await oauth.github.authorize_access_token(request)
    draft_token = request.session.pop('pending_draft_token')

    # Use token.get('access_token') for PR creation
    # Token is NOT stored after this function returns
    pr_url = await create_pr_from_draft(draft_token, token['access_token'])

    return RedirectResponse(f'/draft/{draft_token}?pr_created={pr_url}')
```

### Pattern 2: Git Data API for Atomic Multi-File Commits
**What:** Use GitHub's low-level Git Data API (trees, commits, refs) instead of Contents API for creating commits with multiple files atomically
**When to use:** When committing multiple files that must succeed or fail together
**Example:**
```python
# Source: https://docs.github.com/en/rest/git/trees
async def create_pr_with_files(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    branch_name: str,
    files: list[dict],  # [{"path": "categories/Person.json", "content": "..."}]
    commit_message: str,
    pr_title: str,
    pr_body: str,
) -> str:
    """Create branch, commit files, and open PR atomically."""

    # 1. Get base branch SHA
    base = await client.get(f'/repos/{owner}/{repo}/git/refs/heads/main')
    base_sha = base.json()['object']['sha']
    base_commit = await client.get(f'/repos/{owner}/{repo}/git/commits/{base_sha}')
    base_tree_sha = base_commit.json()['tree']['sha']

    # 2. Create tree with all files (uses content directly, no blob creation)
    tree_items = [
        {
            "path": f["path"],
            "mode": "100644",
            "type": "blob",
            "content": f["content"],
        }
        for f in files
    ]
    tree_resp = await client.post(
        f'/repos/{owner}/{repo}/git/trees',
        json={"base_tree": base_tree_sha, "tree": tree_items}
    )
    new_tree_sha = tree_resp.json()['sha']

    # 3. Create commit
    commit_resp = await client.post(
        f'/repos/{owner}/{repo}/git/commits',
        json={
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [base_sha],
        }
    )
    new_commit_sha = commit_resp.json()['sha']

    # 4. Create branch pointing to new commit
    await client.post(
        f'/repos/{owner}/{repo}/git/refs',
        json={"ref": f"refs/heads/{branch_name}", "sha": new_commit_sha}
    )

    # 5. Create PR
    pr_resp = await client.post(
        f'/repos/{owner}/{repo}/pulls',
        json={
            "title": pr_title,
            "body": pr_body,
            "head": branch_name,
            "base": "main",
        }
    )
    return pr_resp.json()['html_url']
```

### Pattern 3: Structured PR Body Generation
**What:** Generate markdown PR body with change summary, validation report, and semver suggestion
**When to use:** For every PR created from a draft
**Example:**
```python
def generate_pr_body(
    diff: DraftDiffResponse,
    validation: DraftValidationReport,
    wiki_url: str,
    base_version: str,
) -> str:
    """Generate structured PR body from draft data."""

    sections = []

    # Summary section
    sections.append("## Summary\n")
    sections.append(f"Changes proposed from [{wiki_url}]({wiki_url})\n")
    sections.append(f"Based on version: `{base_version}`\n")

    # Changes by type
    sections.append("\n## Changes\n")
    for entity_type in ['categories', 'properties', 'subobjects', 'modules', 'profiles']:
        changes = getattr(diff, entity_type)
        if changes.added or changes.modified or changes.deleted:
            sections.append(f"\n### {entity_type.title()}\n")
            if changes.added:
                sections.append(f"- **Added:** {', '.join(c.entity_id for c in changes.added)}\n")
            if changes.modified:
                sections.append(f"- **Modified:** {', '.join(c.entity_id for c in changes.modified)}\n")
            if changes.deleted:
                sections.append(f"- **Deleted:** {', '.join(c.entity_id for c in changes.deleted)}\n")

    # Validation report
    sections.append("\n## Validation\n")
    status = "Passed" if validation.is_valid else "Failed"
    sections.append(f"**Status:** {status}\n")
    sections.append(f"**Suggested semver:** `{validation.suggested_semver}`\n")

    if validation.errors:
        sections.append(f"\n### Errors ({len(validation.errors)})\n")
        for e in validation.errors:
            sections.append(f"- `{e.entity_id}`: {e.message}\n")

    if validation.warnings:
        sections.append(f"\n### Warnings ({len(validation.warnings)})\n")
        for w in validation.warnings:
            sections.append(f"- `{w.entity_id}`: {w.message}\n")

    return "".join(sections)
```

### Anti-Patterns to Avoid
- **Storing OAuth tokens in database:** Unnecessary for single-operation auth; increases security surface
- **Using Contents API for multi-file commits:** Each file is a separate commit; breaks atomicity
- **Blocking OAuth flow during PR creation:** Keep OAuth callback fast, create PR asynchronously if needed
- **Hardcoding branch names:** Generate unique names with timestamps/UUIDs to prevent conflicts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth state management | Session dict + crypto | Authlib + SessionMiddleware | CSRF protection, proper state encoding |
| OAuth token exchange | Raw HTTP requests | Authlib.authorize_access_token() | Handles error cases, token parsing |
| Multi-file commits | Multiple Contents API calls | Git Data API (trees) | Atomicity, single API call for tree |
| Branch name conflicts | Catch error, retry | Generate unique names upfront | UUID/timestamp prefix prevents all conflicts |
| Rate limit handling | Custom retry loop | tenacity with exponential backoff | Already in codebase, proven pattern |

**Key insight:** GitHub's Git Data API is more complex to understand but far more reliable for programmatic changes. The Contents API is designed for single-file web edits, not batch operations.

## Common Pitfalls

### Pitfall 1: OAuth Scope Confusion
**What goes wrong:** Using `repo` scope when `public_repo` would suffice, or vice versa
**Why it happens:** Scope names are confusing; `public_repo` sounds read-only but includes write access to public repos
**How to avoid:**
- Use `public_repo` if target repo is public (ontology repos typically are)
- Use `repo` only if PRs might target private repos
- Document scope choice in config with comment explaining why
**Warning signs:** "Resource not accessible" errors on PR creation

### Pitfall 2: Branch Name Collisions
**What goes wrong:** PR creation fails with 422/409 because branch already exists
**Why it happens:** Multiple users create drafts from same wiki, branch names collide
**How to avoid:**
- Always include unique identifier in branch name: `draft-{draft_id[:8]}-{timestamp}`
- Before creating branch, check if it exists (or just handle 422 gracefully)
- Consider including wiki URL hash for grouping related drafts
**Warning signs:** Intermittent PR creation failures in production

### Pitfall 3: OAuth Callback State Loss
**What goes wrong:** User redirected to callback but session lost, can't find draft token
**Why it happens:** Session cookie not set (missing middleware), cookie expired, or cross-domain issues
**How to avoid:**
- Ensure SessionMiddleware is added BEFORE OAuth routes
- Set reasonable session expiry (30 minutes is plenty for OAuth flow)
- Store draft token in OAuth state parameter as backup
**Warning signs:** "Missing draft token" errors after OAuth redirect

### Pitfall 4: File Serialization Mismatch
**What goes wrong:** PR created but files have wrong format, breaking downstream tools
**Why it happens:** Draft entities stored in different format than repo expects
**How to avoid:**
- Reference existing repo files to understand exact JSON structure
- Entities use `id` in repo (not `entity_id`), modules use `id` (not `module_id`)
- Always pretty-print JSON with consistent indent (2 spaces)
- Test serialization with round-trip: serialize -> parse -> compare
**Warning signs:** Schema validation failures after merge, or indexer errors

### Pitfall 5: OAuth Token Expiration Mid-Flow
**What goes wrong:** Token obtained but PR creation fails because token expired
**Why it happens:** User took too long between OAuth callback and PR submission
**How to avoid:**
- Execute PR creation immediately in callback, not deferred
- GitHub tokens don't expire quickly, but network issues can delay
- If using async/background task, pass token directly, don't refetch
**Warning signs:** Sporadic "Bad credentials" errors

## Code Examples

### OAuth Flow Initialization (Backend)
```python
# Source: https://docs.authlib.org/en/latest/client/frameworks.html
# File: backend/app/routers/oauth.py

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from app.config import settings

router = APIRouter(prefix="/oauth", tags=["oauth"])

oauth = OAuth()
oauth.register(
    name='github',
    client_id=settings.GITHUB_CLIENT_ID,
    client_secret=settings.GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'public_repo'},
)

@router.get("/github/login")
async def github_login(request: Request, draft_token: str):
    """Start OAuth flow for PR creation.

    Stores draft_token in session to retrieve after callback.
    """
    # Store draft token for callback
    request.session['pending_draft'] = {
        'token': draft_token,
        'initiated_at': datetime.utcnow().isoformat(),
    }

    redirect_uri = str(request.url_for('github_callback'))
    return await oauth.github.authorize_redirect(request, redirect_uri)

@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request, session: SessionDep):
    """Handle OAuth callback and create PR."""
    try:
        token_data = await oauth.github.authorize_access_token(request)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {e.error}")

    pending = request.session.pop('pending_draft', None)
    if not pending:
        raise HTTPException(status_code=400, detail="No pending draft found")

    # Create PR using token
    access_token = token_data['access_token']
    pr_url = await create_pr_from_draft(
        draft_token=pending['token'],
        github_token=access_token,
        session=session,
    )

    # Redirect back to draft page with success message
    return RedirectResponse(
        f"/drafts#{pending['token']}?pr_url={pr_url}",
        status_code=303,
    )
```

### File Serialization (Draft to Repo Format)
```python
# Source: Examining /home/daharoni/dev/labki-schemas structure
# File: backend/app/services/pr_builder.py

import json
from app.models.draft import DraftPayload, EntityDefinition, ModuleDefinition, ProfileDefinition

def serialize_entity_for_repo(entity: EntityDefinition, entity_type: str) -> dict:
    """Convert draft entity to repo file format.

    Repo format uses 'id' not 'entity_id', and flattens schema_definition.

    Categories: {id, label, description, parent, properties, subobjects}
    Properties: {id, label, description, datatype, cardinality}
    Subobjects: {id, label, description, properties}
    """
    base = {
        "id": entity.entity_id,
        "label": entity.label,
        "description": entity.description,
    }

    # Merge schema_definition fields
    schema = entity.schema_definition or {}

    if entity_type == "category":
        return {
            **base,
            "parent": schema.get("parent"),
            "properties": schema.get("properties", []),
            "subobjects": schema.get("subobjects", []),
        }
    elif entity_type == "property":
        return {
            **base,
            "datatype": schema.get("datatype", "Text"),
            "cardinality": schema.get("cardinality", "single"),
        }
    elif entity_type == "subobject":
        return {
            **base,
            "properties": schema.get("properties", []),
        }

    return base

def serialize_module_for_repo(module: ModuleDefinition) -> dict:
    """Convert draft module to repo file format."""
    return {
        "id": module.module_id,
        "label": module.label,
        "description": module.description,
        "categories": module.category_ids,
        "dependencies": module.dependencies,
    }

def serialize_profile_for_repo(profile: ProfileDefinition) -> dict:
    """Convert draft profile to repo file format."""
    return {
        "id": profile.profile_id,
        "label": profile.label,
        "description": profile.description,
        "modules": profile.module_ids,
    }

def build_files_from_draft(payload: DraftPayload) -> list[dict]:
    """Build list of files to commit from draft payload.

    Returns: [{"path": "categories/Person.json", "content": "..."}]
    """
    files = []

    # Entities
    for entity in payload.entities.categories:
        data = serialize_entity_for_repo(entity, "category")
        files.append({
            "path": f"categories/{entity.entity_id}.json",
            "content": json.dumps(data, indent=2) + "\n",
        })

    for entity in payload.entities.properties:
        data = serialize_entity_for_repo(entity, "property")
        files.append({
            "path": f"properties/{entity.entity_id}.json",
            "content": json.dumps(data, indent=2) + "\n",
        })

    for entity in payload.entities.subobjects:
        data = serialize_entity_for_repo(entity, "subobject")
        files.append({
            "path": f"subobjects/{entity.entity_id}.json",
            "content": json.dumps(data, indent=2) + "\n",
        })

    # Modules
    for module in payload.modules:
        data = serialize_module_for_repo(module)
        files.append({
            "path": f"modules/{module.module_id}.json",
            "content": json.dumps(data, indent=2) + "\n",
        })

    # Profiles
    for profile in payload.profiles:
        data = serialize_profile_for_repo(profile)
        files.append({
            "path": f"profiles/{profile.profile_id}.json",
            "content": json.dumps(data, indent=2) + "\n",
        })

    return files
```

### GitHub API Client Extension
```python
# Source: https://docs.github.com/en/rest/git/trees
# File: backend/app/services/github.py (extend existing)

class GitHubClient:
    # ... existing methods ...

    async def create_branch(
        self, owner: str, repo: str, branch_name: str, from_sha: str
    ) -> dict:
        """Create a new branch from the given SHA."""
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": from_sha},
        )

    async def create_tree(
        self,
        owner: str,
        repo: str,
        files: list[dict],
        base_tree: str,
    ) -> str:
        """Create a tree with multiple files.

        Args:
            files: List of {"path": str, "content": str}
            base_tree: SHA of existing tree to base on

        Returns:
            SHA of new tree
        """
        tree_items = [
            {
                "path": f["path"],
                "mode": "100644",
                "type": "blob",
                "content": f["content"],
            }
            for f in files
        ]

        result = await self._request(
            "POST",
            f"/repos/{owner}/{repo}/git/trees",
            json={"base_tree": base_tree, "tree": tree_items},
        )
        return result["sha"]

    async def create_commit(
        self,
        owner: str,
        repo: str,
        message: str,
        tree_sha: str,
        parent_sha: str,
    ) -> str:
        """Create a commit pointing to the given tree.

        Returns:
            SHA of new commit
        """
        result = await self._request(
            "POST",
            f"/repos/{owner}/{repo}/git/commits",
            json={
                "message": message,
                "tree": tree_sha,
                "parents": [parent_sha],
            },
        )
        return result["sha"]

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
    ) -> dict:
        """Create a pull request.

        Returns:
            Full PR object including html_url
        """
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/pulls",
            json={
                "title": title,
                "body": body,
                "head": head,
                "base": base,
            },
        )
```

### Frontend: Open PR Button
```typescript
// File: frontend/src/components/draft/OpenPRButton.tsx

import { Button } from '@/components/ui/button'
import { GitPullRequest, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface OpenPRButtonProps {
  draftToken: string
  isValid: boolean
  disabled?: boolean
}

export function OpenPRButton({ draftToken, isValid, disabled }: OpenPRButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = () => {
    setIsLoading(true)
    // Redirect to OAuth login endpoint with draft token
    const oauthUrl = `/api/v1/oauth/github/login?draft_token=${draftToken}`
    window.location.href = oauthUrl
  }

  const buttonDisabled = disabled || !isValid || isLoading

  return (
    <Button
      onClick={handleClick}
      disabled={buttonDisabled}
      className="gap-2"
      size="lg"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <GitPullRequest className="h-5 w-5" />
      )}
      Open Pull Request
      <ExternalLink className="h-4 w-4" />
    </Button>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth Apps only | GitHub Apps preferred | 2023+ | Apps have fine-grained permissions, short-lived tokens |
| Contents API for commits | Git Data API | Always best practice | Atomic multi-file commits |
| Long-lived tokens | Short-lived + refresh | OAuth 2.0 best practice | Better security |
| Session cookies only | PKCE + session | OAuth 2.1 draft | Enhanced security for web apps |

**Deprecated/outdated:**
- `password` OAuth grant type: Removed from OAuth 2.1
- Implicit grant flow: Deprecated, use authorization code with PKCE
- OAuth Apps without expiring tokens: GitHub still supports but Apps preferred

**Note on GitHub Apps vs OAuth Apps:**
For this use case (user-initiated PRs), OAuth Apps are still appropriate because:
1. The operation is user-initiated, not automated
2. We need to act on behalf of the user (their identity on the PR)
3. We don't need installation-level access
4. Token is used once and discarded

GitHub Apps would be overkill and add complexity (installation flow, JWT signing).

## Open Questions

Things that couldn't be fully resolved:

1. **Handling private repos**
   - What we know: `repo` scope needed for private repos, `public_repo` for public
   - What's unclear: Is the target schema repo always public? Can we assume `public_repo`?
   - Recommendation: Default to `public_repo`, add config option to use `repo` if needed

2. **PR authorship vs committer**
   - What we know: PR is attributed to the user who authorized OAuth
   - What's unclear: Should commit author be the wiki admin or a bot account?
   - Recommendation: Use OAuth user as author (their identity), matches the "wiki admin opens PR" use case

3. **Draft status update on PR creation**
   - What we know: DraftStatus has `SUBMITTED` state
   - What's unclear: Should we store PR URL in draft? What if PR is closed/merged?
   - Recommendation: Store `pr_url` and `pr_number` in draft, update status to `SUBMITTED`

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Pull Requests](https://docs.github.com/en/rest/pulls/pulls) - PR creation endpoint, parameters
- [GitHub REST API - Git Trees](https://docs.github.com/en/rest/git/trees) - Multi-file commit creation
- [GitHub REST API - Git Refs](https://docs.github.com/en/rest/git/refs) - Branch creation/update
- [GitHub OAuth App Best Practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app) - Security practices
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) - `repo` vs `public_repo`
- [Authlib FastAPI Integration](https://docs.authlib.org/en/latest/client/fastapi.html) - OAuth client setup

### Secondary (MEDIUM confidence)
- [GitHub Gist - Create Branch, Commit, PR](https://gist.github.com/nottrobin/a18f9e33286f9db4b83e48af6d285e29) - Verified workflow pattern
- [Medium - Push Multiple Files](https://siddharthav.medium.com/push-multiple-files-under-a-single-commit-through-github-api-f1a5b0b283ae) - Tree API usage

### Tertiary (LOW confidence)
- WebSearch results on session management patterns - general guidance, needs validation in context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Authlib is well-documented, GitHub API is authoritative
- Architecture: HIGH - Patterns verified against official docs and existing codebase
- Pitfalls: HIGH - Based on official docs, common issues well-documented
- File serialization: HIGH - Verified against actual repo file structure at `/home/daharoni/dev/labki-schemas`

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable domain, GitHub API versioned)
