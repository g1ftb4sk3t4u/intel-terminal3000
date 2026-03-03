"""
Intel Terminal 1000 - Configuration
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    # App Settings
    app_name: str = "Intel Terminal 1000"
    debug: bool = False
    secret_key: str = "change-this-in-production-please"
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./intel1000.db"
    
    # Data Source Toggles
    rss_enabled: bool = True
    gdelt_enabled: bool = True
    reddit_enabled: bool = False
    bluesky_enabled: bool = False
    telegram_enabled: bool = False
    
    # RSS Settings
    rss_fetch_interval: int = 300  # seconds
    
    # GDELT Settings
    gdelt_fetch_interval: int = 900  # 15 minutes (matches GDELT update frequency)
    gdelt_max_records: int = 100
    
    # Reddit Settings
    reddit_client_id: Optional[str] = None
    reddit_client_secret: Optional[str] = None
    reddit_user_agent: str = "IntelTerminal1000/1.0"
    reddit_subreddits: List[str] = ["worldnews", "geopolitics", "cybersecurity", "netsec"]
    
    # Bluesky Settings
    bluesky_handle: Optional[str] = None
    bluesky_app_password: Optional[str] = None
    bluesky_feeds: List[str] = ["at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot"]
    
    # Telegram Settings
    telegram_api_id: Optional[int] = None
    telegram_api_hash: Optional[str] = None
    telegram_channels: List[str] = []
    
    # AI/Triage Settings
    triage_method: str = "keyword"  # keyword | ollama | openai | claude | manual
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    claude_model: Optional[str] = "claude-3-opus-20240229"  # Default to Opus 4.6
    
    # Geolocation
    geocode_enabled: bool = True
    geocode_cache_days: int = 30
    
    # Discord Webhook
    discord_webhook_url: Optional[str] = None
    discord_enabled: bool = False
    
    # WebSocket
    ws_heartbeat_interval: int = 30
    
    # Validators to handle empty strings
    @field_validator('telegram_api_id', mode='before')
    @classmethod
    def empty_str_to_none_int(cls, v):
        if v == '' or v is None:
            return None
        return int(v)
    
    @field_validator('reddit_client_id', 'reddit_client_secret', 'bluesky_handle', 
                     'bluesky_app_password', 'telegram_api_hash', 'openai_api_key',
                     'anthropic_api_key', 'discord_webhook_url', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '':
            return None
        return v

    @field_validator('database_url', mode='before')
    @classmethod
    def ensure_async_sqlite_driver(cls, v):
        if isinstance(v, str) and v.startswith('sqlite:///'):
            return v.replace('sqlite:///', 'sqlite+aiosqlite:///', 1)
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
