from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    app_name: str = "Remote Data Scientist Job Agent"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/job_agent"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    scrape_window_hours: int = 72
    auto_submit_applications: bool = False
    playwright_headless: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
