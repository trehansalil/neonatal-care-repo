"""Settings and Configuration Management

Handles configuration from .env files and Azure Key Vault based on environment.
"""

import os
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with support for .env and Azure Key Vault."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Environment
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    
    # Azure OpenAI
    azure_openai_endpoint: str = Field(default="", alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_key: str = Field(default="", alias="AZURE_OPENAI_KEY")
    azure_openai_deployment: str = Field(default="", alias="AZURE_OPENAI_DEPLOYMENT")

    # MinIO / S3
    minio_endpoint: str = Field(default="minio:9000", alias="MINIO_ENDPOINT")
    # External endpoint for browser-accessible presigned URLs (defaults to localhost:9002 based on docker-compose port mapping)
    minio_external_endpoint: str = Field(default="localhost:9002", alias="MINIO_EXTERNAL_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_bucket_name: str = Field(default="neonatal-data", alias="MINIO_BUCKET_NAME")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    azure_openai_api_version: str = Field(default="2024-02-15-preview", alias="AZURE_OPENAI_API_VERSION")
    
    # AssemblyAI
    assemblyai_api_key: str = Field(default="", alias="ASSEMBLYAI_API_KEY")
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_workers: int = Field(default=4, alias="API_WORKERS")
    api_reload: bool = Field(default=False, alias="API_RELOAD")
    api_secret_key: str = Field(default="change-this-secret-key", alias="API_SECRET_KEY")
    api_algorithm: str = Field(default="HS256", alias="API_ALGORITHM")
    api_access_token_expire_minutes: float = Field(default=0.5, alias="API_ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # Application Settings
    max_upload_size_mb: int = Field(default=100, alias="MAX_UPLOAD_SIZE_MB")
    allowed_audio_formats: str = Field(default=".wav,.mp3,.m4a,.webm,.ogg,.mp4", alias="ALLOWED_AUDIO_FORMATS")
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")

    
    @property
    def allowed_audio_formats_list(self) -> list[str]:
        """Return allowed audio formats as a list."""
        return [fmt.strip() for fmt in self.allowed_audio_formats.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    return settings

configured_settings = get_settings()