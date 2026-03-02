"""
Intel Terminal 1000 - Database Models
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, JSON, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

# Many-to-many relationship for article hashtags
article_hashtags = Table(
    'article_hashtags',
    Base.metadata,
    Column('article_id', Integer, ForeignKey('articles.id'), primary_key=True),
    Column('hashtag_id', Integer, ForeignKey('hashtags.id'), primary_key=True)
)


class Article(Base):
    """Intelligence article from any source"""
    __tablename__ = "articles"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Core fields
    title = Column(String(500), nullable=False)
    link = Column(String(1000), unique=True, nullable=False)
    summary = Column(Text)
    content = Column(Text)
    
    # Source information
    source = Column(String(100), index=True)  # Source name (e.g., "BBC", "r/worldnews")
    source_type = Column(String(50), index=True)  # rss, reddit, bluesky, telegram, gdelt
    source_url = Column(String(500))
    
    # Categorization
    category = Column(String(100), index=True)  # User-defined category
    severity = Column(String(20), default="low", index=True)  # critical, high, medium, low
    manually_triaged = Column(Boolean, default=False)
    
    # Geolocation (extracted from content)
    locations = Column(JSON)  # ["Moscow", "Ukraine", "Washington DC"]
    primary_location = Column(String(200))  # Main location
    latitude = Column(Float)
    longitude = Column(Float)
    region = Column(String(100))  # Continent/region for heat map grouping
    country = Column(String(100))
    
    # AI-generated content
    ai_summary = Column(Text)
    ai_tags = Column(JSON)  # ["cyber", "russia", "infrastructure"]
    
    # Timestamps
    published_at = Column(DateTime)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Status
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Relationships
    hashtags = relationship("Hashtag", secondary=article_hashtags, back_populates="articles")


class Hashtag(Base):
    """User-defined hashtags for categorization"""
    __tablename__ = "hashtags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    color = Column(String(7), default="#6366f1")  # Hex color
    created_at = Column(DateTime, default=datetime.utcnow)
    
    articles = relationship("Article", secondary=article_hashtags, back_populates="hashtags")


class Source(Base):
    """Data source configuration"""
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    url = Column(String(500))
    source_type = Column(String(50), nullable=False)  # rss, reddit, bluesky, telegram, gdelt
    category = Column(String(100))
    enabled = Column(Boolean, default=True)
    fetch_interval = Column(Integer, default=300)  # seconds
    last_fetched = Column(DateTime)
    error_count = Column(Integer, default=0)
    config = Column(JSON)  # Source-specific configuration
    created_at = Column(DateTime, default=datetime.utcnow)


class Dashboard(Base):
    """User dashboard configuration"""
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    layout = Column(String(20), default="2x2")  # 1x1, 2x1, 1x2, 2x2, 3x1, etc.
    panels = Column(JSON)  # Panel configurations
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeoCache(Base):
    """Cache for geocoding results"""
    __tablename__ = "geo_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(200), unique=True, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    country = Column(String(100))
    region = Column(String(100))
    cached_at = Column(DateTime, default=datetime.utcnow)


class TriageKeyword(Base):
    """Keywords for automatic severity triage"""
    __tablename__ = "triage_keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    weight = Column(Integer, default=1)  # Higher weight = more importance
    category = Column(String(100))  # Optional: only apply to specific category
    is_regex = Column(Boolean, default=False)  # If true, treat as regex pattern
    enabled = Column(Boolean, default=True)
    match_count = Column(Integer, default=0)  # Track how often it matches
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Description for clarity
    description = Column(String(255))


class Alert(Base):
    """Custom alert rules"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    
    # Trigger conditions (JSON for flexibility)
    conditions = Column(JSON)  # {"keywords": ["CVE"], "severity": ["critical"], "categories": ["cyber"]}
    
    # Actions
    discord_notify = Column(Boolean, default=False)
    sound_notify = Column(Boolean, default=True)
    
    # Stats
    trigger_count = Column(Integer, default=0)
    last_triggered = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrendingAlert(Base):
    """Auto-generated alerts for trending regions/topics"""
    __tablename__ = "trending_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False)  # region_spike, keyword_surge, new_conflict
    
    # What triggered it
    region = Column(String(100))
    country = Column(String(100))
    keyword = Column(String(200))
    
    # Stats
    article_count = Column(Integer, default=0)  # Articles in time window
    previous_count = Column(Integer, default=0)  # Previous window for comparison
    spike_percentage = Column(Float)  # % increase
    
    # Sample article IDs
    sample_articles = Column(JSON)  # [1, 2, 3, 4, 5]
    
    # Status
    is_active = Column(Boolean, default=True)
    is_acknowledged = Column(Boolean, default=False)
    severity = Column(String(20), default="high")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class AircraftTrack(Base):
    """Aircraft tracking data from ADS-B"""
    __tablename__ = "aircraft_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Aircraft identifiers
    icao = Column(String(10), index=True)  # ICAO 24-bit address
    callsign = Column(String(10), index=True)
    registration = Column(String(15))
    aircraft_type = Column(String(10))  # B738, A320, etc
    
    # Position
    latitude = Column(Float)
    longitude = Column(Float)
    altitude = Column(Integer)  # feet
    heading = Column(Integer)  # degrees
    speed = Column(Integer)  # knots
    vertical_rate = Column(Integer)  # feet/min
    
    # Flags
    is_military = Column(Boolean, default=False)
    is_interesting = Column(Boolean, default=False)  # Flagged for tracking
    squawk = Column(String(4))  # Transponder code
    
    # Context
    origin = Column(String(100))
    destination = Column(String(100))
    notes = Column(Text)
    
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
