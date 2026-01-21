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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
