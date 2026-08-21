from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Panel
    c3_host: str = "192.168.1.201"
    c3_port: int = 4370
    c3_password: str = ""
    c3_door_no: int = 1
    c3_open_seconds: int = 5

    # Watchdog / reconnect
    c3_connect_timeout: int = 5
    c3_retry_base: float = 1.0
    c3_retry_max: float = 30.0
    c3_watchdog_interval: int = 10
    c3_rtlog_poll_ms: int = 800

    # Tokens
    token_secret: str = "change-me-shared-with-erp"
    token_window_seconds: int = 30
    token_skew_windows: int = 1

    # Service auth
    service_api_key: str = "change-me-service-key"

    # ERP webhook (optional)
    erp_webhook_url: str = ""
    erp_webhook_key: str = ""


settings = Settings()
