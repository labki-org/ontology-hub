from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS configuration (comma-separated origins, empty for same-origin only)
    CORS_ORIGINS: str = ""

    # GitHub API configuration
    GITHUB_TOKEN: str | None = None  # Optional for startup, required for sync
    GITHUB_REPO_OWNER: str = "labki-org"
    GITHUB_REPO_NAME: str = "labki-ontology"
    GITHUB_WEBHOOK_SECRET: str | None = None

    # GitHub OAuth configuration
    GITHUB_CLIENT_ID: str | None = None
    GITHUB_CLIENT_SECRET: str | None = None
    SESSION_SECRET: str = "dev-secret-key-replace-in-production-with-random-32-byte-hex"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def github_repo(self) -> str:
        """Full repository path as owner/repo."""
        return f"{self.GITHUB_REPO_OWNER}/{self.GITHUB_REPO_NAME}"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
