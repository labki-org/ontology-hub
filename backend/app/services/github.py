"""GitHub API client with rate limit handling and exponential backoff."""

import base64
import json
import logging
from typing import Any

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)

# Directories containing entity JSON files
ENTITY_DIRECTORIES = frozenset(
    {"categories", "properties", "subobjects", "modules", "profiles"}
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
    async def _request(
        self, method: str, url: str, **kwargs: Any
    ) -> dict[str, Any]:
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
        return response.json()

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
                "Repository tree truncated at %d entries. "
                "Some files may be missing.",
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

        return json.loads(content_str)

    async def get_latest_commit_sha(
        self, owner: str, repo: str, branch: str = "main"
    ) -> str:
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
        return data["sha"]

    async def get_releases(
        self, owner: str, repo: str, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch releases from GitHub repository.

        Args:
            owner: Repository owner
            repo: Repository name
            per_page: Number of releases to fetch (max 100)

        Returns:
            List of release objects with tag_name, name, created_at, published_at, body
        """
        url = f"/repos/{owner}/{repo}/releases"
        return await self._request("GET", url, params={"per_page": per_page})

    async def get_file_at_ref(
        self, owner: str, repo: str, path: str, ref: str
    ) -> dict[str, Any]:
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
