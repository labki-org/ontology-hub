"""GitHub API client with rate limit handling and exponential backoff."""

import base64
import json
import logging
from typing import Any, cast

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)

# Directories containing entity JSON files (v2.0)
ENTITY_DIRECTORIES = frozenset(
    {"categories", "properties", "subobjects", "modules", "bundles", "templates", "dashboards", "resources"}
)


class GitHubRateLimitError(Exception):
    """Raised when GitHub returns 403 with rate limit exceeded."""

    def __init__(self, reset_time: int, message: str = "GitHub rate limit exceeded"):
        self.reset_time = reset_time
        super().__init__(message)


class GitHubClient:
    """Async GitHub API client with retry logic for rate limits.

    Receives a pre-configured httpx.AsyncClient (created in app lifespan)
    to benefit from connection pooling and proper lifecycle management.
    """

    def __init__(self, client: httpx.AsyncClient):
        """Initialize with a pre-configured httpx AsyncClient.

        Args:
            client: httpx.AsyncClient configured with GitHub API base URL and auth headers
        """
        self._client = client

    @retry(
        retry=retry_if_exception_type(GitHubRateLimitError),
        wait=wait_exponential_jitter(initial=1, max=120),
        stop=stop_after_attempt(5),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    async def _request(self, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
        """Make a request to GitHub API with rate limit handling.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: API endpoint path (relative to base URL)
            **kwargs: Additional arguments passed to httpx request

        Returns:
            Parsed JSON response

        Raises:
            GitHubRateLimitError: When rate limit is exceeded (will be retried)
            httpx.HTTPStatusError: For other HTTP errors
        """
        response = await self._client.request(method, url, **kwargs)

        if response.status_code == 403:
            remaining = int(response.headers.get("x-ratelimit-remaining", 1))
            if remaining == 0:
                reset_time = int(response.headers.get("x-ratelimit-reset", 0))
                logger.warning(
                    "GitHub rate limit exceeded, reset at %s",
                    reset_time,
                )
                raise GitHubRateLimitError(reset_time)

        response.raise_for_status()
        return cast(dict[str, Any], response.json())

    async def get_repository_tree(
        self, owner: str, repo: str, sha: str = "HEAD"
    ) -> list[dict[str, Any]]:
        """Fetch complete repository tree recursively.

        Uses Git Trees API with recursive=1 for efficient single-call listing.
        Filters results to only include .json files in entity directories.

        Args:
            owner: Repository owner
            repo: Repository name
            sha: Git tree SHA or "HEAD" for latest

        Returns:
            List of tree entries with path, type, sha, size
        """
        url = f"/repos/{owner}/{repo}/git/trees/{sha}"
        data = await self._request("GET", url, params={"recursive": "1"})

        if data.get("truncated"):
            logger.warning(
                "Repository tree truncated at %d entries. Some files may be missing.",
                len(data.get("tree", [])),
            )

        # Filter for .json files in target directories
        return [
            entry
            for entry in data.get("tree", [])
            if entry.get("type") == "blob"
            and entry.get("path", "").endswith(".json")
            and entry.get("path", "").split("/")[0] in ENTITY_DIRECTORIES
        ]

    async def get_file_content(
        self, owner: str, repo: str, path: str, ref: str = "main"
    ) -> dict[str, Any]:
        """Fetch and decode a single JSON file from GitHub.

        Args:
            owner: Repository owner
            repo: Repository name
            path: File path within repository
            ref: Git ref (branch, tag, or commit SHA)

        Returns:
            Parsed JSON content of the file
        """
        url = f"/repos/{owner}/{repo}/contents/{path}"
        data = await self._request("GET", url, params={"ref": ref})

        # Content is base64 encoded
        content_bytes = base64.b64decode(data["content"])
        content_str = content_bytes.decode("utf-8")

        return cast(dict[str, Any], json.loads(content_str))

    async def get_latest_commit_sha(self, owner: str, repo: str, branch: str = "main") -> str:
        """Get the SHA of the latest commit on a branch.

        Args:
            owner: Repository owner
            repo: Repository name
            branch: Branch name

        Returns:
            Commit SHA string
        """
        url = f"/repos/{owner}/{repo}/commits/{branch}"
        data = await self._request("GET", url)
        return cast(str, data["sha"])

    async def get_releases(self, owner: str, repo: str, per_page: int = 30) -> list[dict[str, Any]]:
        """Fetch releases from GitHub repository.

        Args:
            owner: Repository owner
            repo: Repository name
            per_page: Number of releases to fetch (max 100)

        Returns:
            List of release objects with tag_name, name, created_at, published_at, body
        """
        url = f"/repos/{owner}/{repo}/releases"
        # GitHub releases API returns a JSON array, cast appropriately
        response = await self._client.request("GET", url, params={"per_page": per_page})
        response.raise_for_status()
        return cast(list[dict[str, Any]], response.json())

    async def get_file_at_ref(self, owner: str, repo: str, path: str, ref: str) -> dict[str, Any]:
        """Fetch and decode a JSON file at a specific git ref (tag/sha).

        Same as get_file_content but with explicit ref parameter.

        Args:
            owner: Repository owner
            repo: Repository name
            path: File path within repository
            ref: Git ref (branch, tag, or commit SHA)

        Returns:
            Parsed JSON content of the file
        """
        return await self.get_file_content(owner, repo, path, ref=ref)

    # Git Data API methods for PR creation

    async def get_branch_sha(self, owner: str, repo: str, branch: str = "main") -> str:
        """Get the SHA of a branch reference.

        Args:
            owner: Repository owner
            repo: Repository name
            branch: Branch name (default: "main")

        Returns:
            SHA string of the branch reference
        """
        url = f"/repos/{owner}/{repo}/git/refs/heads/{branch}"
        data = await self._request("GET", url)
        return cast(str, data["object"]["sha"])

    async def get_commit_tree_sha(self, owner: str, repo: str, commit_sha: str) -> str:
        """Get the tree SHA from a commit.

        Args:
            owner: Repository owner
            repo: Repository name
            commit_sha: Commit SHA

        Returns:
            Tree SHA string
        """
        url = f"/repos/{owner}/{repo}/git/commits/{commit_sha}"
        data = await self._request("GET", url)
        return cast(str, data["tree"]["sha"])

    async def create_tree(self, owner: str, repo: str, files: list[dict], base_tree: str) -> str:
        """Create a new git tree with files.

        Args:
            owner: Repository owner
            repo: Repository name
            files: List of dicts with "path" and "content" OR "path" and "delete": True
            base_tree: Base tree SHA to build upon

        Returns:
            New tree SHA
        """
        # Convert files to git tree items
        tree_items = []
        for file in files:
            if file.get("delete"):
                # Delete file by setting sha to null
                tree_items.append(
                    {
                        "path": file["path"],
                        "mode": "100644",
                        "type": "blob",
                        "sha": None,
                    }
                )
            else:
                # Add/update file with content
                tree_items.append(
                    {
                        "path": file["path"],
                        "mode": "100644",
                        "type": "blob",
                        "content": file["content"],
                    }
                )

        url = f"/repos/{owner}/{repo}/git/trees"
        data = await self._request("POST", url, json={"tree": tree_items, "base_tree": base_tree})
        return cast(str, data["sha"])

    async def create_commit(
        self, owner: str, repo: str, message: str, tree_sha: str, parent_sha: str
    ) -> str:
        """Create a new git commit.

        Args:
            owner: Repository owner
            repo: Repository name
            message: Commit message
            tree_sha: Tree SHA for this commit
            parent_sha: Parent commit SHA

        Returns:
            New commit SHA
        """
        url = f"/repos/{owner}/{repo}/git/commits"
        data = await self._request(
            "POST",
            url,
            json={"message": message, "tree": tree_sha, "parents": [parent_sha]},
        )
        return cast(str, data["sha"])

    async def create_branch(
        self, owner: str, repo: str, branch_name: str, sha: str
    ) -> dict[str, Any]:
        """Create a new branch reference.

        Args:
            owner: Repository owner
            repo: Repository name
            branch_name: Name for the new branch
            sha: Commit SHA for the branch to point to

        Returns:
            Full ref object
        """
        url = f"/repos/{owner}/{repo}/git/refs"
        return await self._request(
            "POST", url, json={"ref": f"refs/heads/{branch_name}", "sha": sha}
        )

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
    ) -> dict[str, Any]:
        """Create a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            title: PR title
            body: PR body (markdown)
            head: Branch name to merge from
            base: Branch name to merge into (default: "main")

        Returns:
            Full PR object with html_url
        """
        url = f"/repos/{owner}/{repo}/pulls"
        return await self._request(
            "POST",
            url,
            json={"title": title, "body": body, "head": head, "base": base},
        )

    async def create_pr_with_token(
        self,
        token: str,
        owner: str,
        repo: str,
        branch_name: str,
        files: list[dict],
        commit_message: str,
        pr_title: str,
        pr_body: str,
        base_branch: str = "main",
    ) -> str:
        """Create a PR with user's OAuth token (full atomic workflow).

        Creates branch, commit, and PR in sequence using user's token.

        Args:
            token: User's GitHub OAuth access token
            owner: Repository owner
            repo: Repository name
            branch_name: Name for the new branch
            files: List of dicts with "path" and "content" keys
            commit_message: Commit message
            pr_title: PR title
            pr_body: PR body (markdown)
            base_branch: Base branch to merge into (default: "main")

        Returns:
            PR html_url
        """
        # Create temporary httpx client with user's token
        async with httpx.AsyncClient(
            base_url="https://api.github.com",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Ontology-Hub",
            },
            timeout=30.0,
        ) as client:
            # Create temporary GitHubClient instance
            temp_client = GitHubClient(client)

            # 1. Get latest commit SHA from base branch
            base_sha = await temp_client.get_branch_sha(owner, repo, base_branch)

            # 2. Get tree SHA from base commit
            base_tree_sha = await temp_client.get_commit_tree_sha(owner, repo, base_sha)

            # 3. Create new tree with files
            new_tree_sha = await temp_client.create_tree(owner, repo, files, base_tree_sha)

            # 4. Create commit
            new_commit_sha = await temp_client.create_commit(
                owner, repo, commit_message, new_tree_sha, base_sha
            )

            # 5. Create branch
            await temp_client.create_branch(owner, repo, branch_name, new_commit_sha)

            # 6. Create pull request
            pr = await temp_client.create_pull_request(
                owner, repo, pr_title, pr_body, branch_name, base_branch
            )

            return cast(str, pr["html_url"])
