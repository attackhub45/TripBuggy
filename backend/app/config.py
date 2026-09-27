from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-sonnet-5"
    # Cheaper/faster model for mechanical tasks (reformatting research into JSON, answering
    # in-app help questions) where Sonnet-level reasoning isn't needed — see docs/ROADMAP.md's
    # cost notes.
    anthropic_model_fast: str = "claude-haiku-4-5-20251001"
    # Comma-separated list, e.g. "http://localhost:5173,https://tripbuggy.azurestaticapps.net"
    cors_origins: str = "http://localhost:5173"
    # Operator-only back door (list/reset-password/delete users) — not a customer-facing
    # feature. None means the admin routes are disabled entirely (fail closed), not open.
    admin_token: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
