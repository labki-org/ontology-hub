from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # GitHub API configuration
    GITHUB_TOKEN: Optional[str] = None  # Optional for startup, required for sync
    GITHUB_REPO_OWNER: str = "labki-org"
    GITHUB_REPO_NAME: str = "labki-schemas"
    GITHUB_WEBHOOK_SECRET: Optional[str] = None

    # GitHub OAuth configuration
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    SESSION_SECRET: str = "dev-secret-key-replace-in-production-with-random-32-byte-hex"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def github_repo(self) -> str:
        """Full repository path as owner/repo."""
        return f"{self.GITHUB_REPO_OWNER}/{self.GITHUB_REPO_NAME}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
