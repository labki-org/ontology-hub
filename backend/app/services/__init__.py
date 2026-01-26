"""Services for external integrations and business logic.

v2.0 services are organized by domain:
- github.py - GitHub API client
- ingest.py - Repository sync/ingest
- draft_overlay.py - Draft overlay computation
- draft_rebase.py - Draft rebase operations
- draft_workflow.py - Draft status transitions
- graph_query.py - Graph query operations
- pr_builder.py - PR file generation
- module_derived.py - Module derived entity computation
"""

from app.services.github import GitHubClient, GitHubRateLimitError

__all__ = [
    "GitHubClient",
    "GitHubRateLimitError",
]
