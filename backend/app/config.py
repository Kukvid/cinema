from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import BeforeValidator
from functools import lru_cache
from typing import List, Union, Annotated


def parse_cors_origins(v: Union[str, List[str]]) -> List[str]:
    """Парсинг CORS_ORIGINS из строки с разделителями-запятыми или списка"""
    if isinstance(v, str):
        return [origin.strip() for origin in v.split(',')]
    elif isinstance(v, list):
        return v
    return []


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Cinema Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - используем Union чтобы избежать автоматического JSON парсинга
    CORS_ORIGINS: Annotated[
        Union[str, List[str]],
        BeforeValidator(parse_cors_origins)
    ] = "http://localhost:3000,http://localhost:5173"

    # Bonus System
    BONUS_ACCRUAL_PERCENTAGE: int = 10
    BONUS_POINTS_PER_RUBLE: int = 1
    BONUS_INITIAL_AMOUNT: int = 500
    BONUS_MAX_PERCENTAGE: int = 99
    BONUS_MIN_PAYMENT_AMOUNT: int = 11

    # Reservation
    SEAT_RESERVATION_TIMEOUT_MINUTES: int = 5

    # Payment
    ORDER_PAYMENT_TIMEOUT_MINUTES: int = 5

    # QR Code
    QR_CODE_SIZE: int = 10
    QR_CODE_BORDER: int = 4

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Reports
    REPORTS_DIR: str = "reports"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_parse_none_str='null'
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
