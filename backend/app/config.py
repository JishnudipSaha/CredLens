"""Application settings loaded from environment variables (.env optional)."""
from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
DATA_DIR = BACKEND_ROOT / "data"
ARTIFACT_DIR = BACKEND_ROOT / "app" / "ml" / "artifacts"
DATA_DIR.mkdir(exist_ok=True)
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CREDLENS_", extra="ignore")

    app_name: str = "CredLens - AI Powered MSME Credit Intelligence"
    version: str = "0.1.0"
    debug: bool = False  # set True in local dev

    # Database
    database_url: str = f"sqlite:///{DATA_DIR / 'credlens.db'}"

    # Security
    secret_key: str = "dev-secret-change-me-in-production-9f8a3b2c1d4e5f6a"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 8  # 8 hours

    # ML artifacts
    model_path: Path = ARTIFACT_DIR / "risk_model.pkl"
    features_path: Path = ARTIFACT_DIR / "features.json"

    # CORS - accepts a comma-separated string for env-var friendliness
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _normalize_cors(cls, v):
        if isinstance(v, list):
            return ",".join(str(x) for x in v)
        return v

    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
