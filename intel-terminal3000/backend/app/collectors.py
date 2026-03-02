"""
Intel Terminal 1000 - Multi-Source Data Collectors
Supports: RSS, GDELT, Reddit, Bluesky, Telegram
"""
import asyncio
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
import feedparser
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Article, Source
from .config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class BaseCollector(ABC):
    """Abstract base class for all data collectors"""
    
    source_type: str = "base"
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IntelTerminal/2.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            follow_redirects=True,
        )
    
    @abstractmethod
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        """Fetch raw data from source"""
        pass
    
    def generate_link_hash(self, link: str) -> str:
        """Generate unique hash for deduplication"""
        return hashlib.sha256(link.encode()).hexdigest()[:16]
    
    async def save_articles(self, articles: List[Dict[str, Any]], source: Source) -> int:
        """Save articles to database, skip duplicates"""
        saved_count = 0
        
        for article_data in articles:
            # Check for duplicate
            existing = await self.session.execute(
                select(Article).where(Article.link == article_data["link"])
            )
            if existing.scalar_one_or_none():
                continue
            
            article = Article(
                title=article_data.get("title", "Untitled")[:500],
                link=article_data["link"],
                summary=article_data.get("summary"),
                content=article_data.get("content"),
                source=source.name,
                source_type=self.source_type,
                source_url=source.url,
                category=source.category,
                published_at=article_data.get("published_at"),
                locations=article_data.get("locations"),
                latitude=article_data.get("latitude"),
                longitude=article_data.get("longitude"),
                country=article_data.get("country"),
                region=article_data.get("region"),
            )
            self.session.add(article)
            saved_count += 1
        
        await self.session.commit()
        return saved_count
    
    async def close(self):
        await self.http_client.aclose()


class RSSCollector(BaseCollector):
    """RSS/Atom feed collector"""
    
    source_type = "rss"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        
        try:
            logger.info(f"Fetching RSS: {source.url}")
            response = await self.http_client.get(source.url)
            logger.info(f"RSS response status: {response.status_code}, length: {len(response.text)}")
            
            feed = feedparser.parse(response.text)
            logger.info(f"Feed parsed, entries: {len(feed.entries)}, bozo: {feed.bozo}")
            
            for entry in feed.entries[:50]:  # Limit per fetch
                published = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6])
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    published = datetime(*entry.updated_parsed[:6])
                
                articles.append({
                    "title": entry.get("title", "Untitled"),
                    "link": entry.get("link", ""),
                    "summary": entry.get("summary", "")[:2000] if entry.get("summary") else None,
                    "content": entry.get("content", [{}])[0].get("value", "") if entry.get("content") else None,
                    "published_at": published,
                })
            
            logger.info(f"RSS collected {len(articles)} articles from {source.name}")
                
        except Exception as e:
            logger.error(f"RSS fetch error for {source.name}: {e}")
        
        return articles


class GDELTCollector(BaseCollector):
    """
    GDELT (Global Database of Events, Language, and Tone) collector
    - Updates every 15 minutes
    - Already has geolocation data
    - Free and comprehensive
    """
    
    source_type = "gdelt"
    GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        config = source.config or {}
        
        # Build query parameters
        params = {
            "query": config.get("query", "security OR conflict OR crisis"),
            "mode": "ArtList",
            "maxrecords": config.get("max_records", 50),
            "format": "json",
            "timespan": config.get("timespan", "15min"),  # Last 15 minutes
            "sort": "DateDesc",
        }
        
        try:
            response = await self.http_client.get(self.GDELT_API, params=params)
            data = response.json()
            
            for item in data.get("articles", []):
                # GDELT provides location data
                articles.append({
                    "title": item.get("title", "Untitled"),
                    "link": item.get("url", ""),
                    "summary": item.get("title"),  # GDELT doesn't provide summaries
                    "published_at": self._parse_gdelt_date(item.get("seendate")),
                    "source_domain": item.get("domain"),
                    # Geolocation from GDELT
                    "country": item.get("sourcecountry"),
                    "locations": [item.get("sourcecountry")] if item.get("sourcecountry") else None,
                })
                
        except Exception as e:
            logger.error(f"GDELT fetch error: {e}")
        
        return articles
    
    def _parse_gdelt_date(self, date_str: str) -> Optional[datetime]:
        """Parse GDELT date format: 20240115T123456Z"""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, "%Y%m%dT%H%M%SZ")
        except:
            return None


class RedditCollector(BaseCollector):
    """Reddit collector using PRAW (async wrapper)"""
    
    source_type = "reddit"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        config = source.config or {}
        subreddit = config.get("subreddit", "worldnews")
        
        # Use Reddit JSON API (no auth needed for public posts)
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit=25"
        
        try:
            headers = {"User-Agent": settings.reddit_user_agent}
            response = await self.http_client.get(url, headers=headers)
            data = response.json()
            
            for post in data.get("data", {}).get("children", []):
                post_data = post.get("data", {})
                
                # Skip stickied posts
                if post_data.get("stickied"):
                    continue
                
                articles.append({
                    "title": post_data.get("title", "Untitled"),
                    "link": f"https://reddit.com{post_data.get('permalink', '')}",
                    "summary": post_data.get("selftext", "")[:2000] or post_data.get("url"),
                    "published_at": datetime.fromtimestamp(post_data.get("created_utc", 0)),
                    "content": post_data.get("selftext"),
                })
                
        except Exception as e:
            logger.error(f"Reddit fetch error for r/{subreddit}: {e}")
        
        return articles


class BlueskyCollector(BaseCollector):
    """Bluesky/AT Protocol collector"""
    
    source_type = "bluesky"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        config = source.config or {}
        
        # Use public Bluesky API (no auth for public feeds)
        # This fetches from public timelines or specific feeds
        feed_uri = config.get("feed_uri", "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot")
        
        try:
            # Bluesky public API endpoint
            url = "https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed"
            params = {"feed": feed_uri, "limit": 30}
            
            response = await self.http_client.get(url, params=params)
            data = response.json()
            
            for item in data.get("feed", []):
                post = item.get("post", {})
                record = post.get("record", {})
                
                # Create a link from the post URI
                uri = post.get("uri", "")
                handle = post.get("author", {}).get("handle", "unknown")
                post_id = uri.split("/")[-1] if uri else ""
                link = f"https://bsky.app/profile/{handle}/post/{post_id}"
                
                articles.append({
                    "title": record.get("text", "")[:200] + "..." if len(record.get("text", "")) > 200 else record.get("text", "Untitled"),
                    "link": link,
                    "summary": record.get("text"),
                    "published_at": self._parse_iso_date(record.get("createdAt")),
                    "content": record.get("text"),
                })
                
        except Exception as e:
            logger.error(f"Bluesky fetch error: {e}")
        
        return articles
    
    def _parse_iso_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except:
            return None


class TelegramCollector(BaseCollector):
    """
    Telegram public channel collector
    Note: Requires API credentials for full functionality
    This uses a web scraping approach for public channels
    """
    
    source_type = "telegram"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        config = source.config or {}
        channel = config.get("channel", "")
        
        if not channel:
            return articles
        
        # Use Telegram's public web view
        url = f"https://t.me/s/{channel}"
        
        try:
            response = await self.http_client.get(url)
            # Basic parsing of Telegram web view
            # This is a simplified approach - full implementation would use telethon
            
            from html.parser import HTMLParser
            
            class TelegramParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.messages = []
                    self.current_message = None
                    self.in_message = False
                    
                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)
                    if tag == "div" and "tgme_widget_message_wrap" in attrs_dict.get("class", ""):
                        self.current_message = {"text": "", "link": ""}
                        self.in_message = True
                    if self.in_message and tag == "a" and "tgme_widget_message_date" in attrs_dict.get("class", ""):
                        self.current_message["link"] = attrs_dict.get("href", "")
                        
                def handle_data(self, data):
                    if self.in_message and self.current_message:
                        self.current_message["text"] += data
                        
                def handle_endtag(self, tag):
                    if tag == "div" and self.in_message and self.current_message:
                        if self.current_message.get("link"):
                            self.messages.append(self.current_message)
                        self.current_message = None
                        self.in_message = False
            
            parser = TelegramParser()
            parser.feed(response.text)
            
            for msg in parser.messages[:20]:
                text = msg["text"].strip()[:500]
                articles.append({
                    "title": text[:100] + "..." if len(text) > 100 else text,
                    "link": msg["link"],
                    "summary": text,
                    "published_at": datetime.utcnow(),  # Telegram web doesn't show exact times easily
                })
                
        except Exception as e:
            logger.error(f"Telegram fetch error for {channel}: {e}")
        
        return articles


class ADSBCollector(BaseCollector):
    """
    ADS-B Exchange collector for aircraft tracking
    Tracks military aircraft, interesting flights, etc.
    """
    
    source_type = "adsb"
    
    # ADS-B Exchange endpoints (free tier)
    ADSB_RAPID_API = "https://adsbexchange-com1.p.rapidapi.com/v2"
    ADSB_FREE_API = "https://opensky-network.org/api"  # Free alternative
    
    # Military aircraft type codes to watch (expanded)
    MILITARY_TYPES = [
        # US Bombers
        "B52", "B1B", "B2", "B1", "B52H",
        # US Tankers
        "KC135", "KC10", "KC46", "KC130",
        # US AWACS/ISR
        "E3", "E6", "E8", "E4B", "RC135", "EC130", "EP3", "WC135", "OC135",
        # US Transport
        "C17", "C5", "C130", "C40", "C32", "C37", "C12", "C20", "C21",
        # US Patrol/ASW
        "P8", "P3", "P8A",
        # US Drones
        "MQ9", "RQ4", "MQ1", "MQ4", "RQ170",
        # US Spy planes
        "U2", "SR71", "TR1",
        # US Fighters
        "F15", "F16", "F22", "F35", "F18", "FA18", "F117",
        # US Attack
        "A10", "AC130", "AH64", "AH1",
        # US Rotary
        "V22", "CV22", "MV22", "CH47", "CH53", "HH60", "UH60", "MH60", "MH53",
        # UK Military
        "TYPHOON", "VOYAGER", "ATLAS", "RIVET", "SENTRY", "POSEIDON",
        # NATO/European
        "TOR", "EF2000", "RAFALE", "GRIPEN", "EUFI", "MRTT", "A400", "A330MRTT",
        # Russian (if visible)
        "IL76", "IL78", "AN124", "AN22", "TU95", "TU160", "TU22", "SU27", "SU30", "SU35", "MIG",
    ]
    
    # Interesting callsign prefixes (military/government)
    MILITARY_PREFIXES = [
        # US Military
        "RCH", "REACH",  # Air Mobility Command
        "DUKE",  # Special Ops
        "EVAC",  # Aeromedical
        "NCHO", "NIGHTHAWK",  # Special missions
        "JAKE", "GOLD",  # Tankers
        "SPAR",  # VIP/Government
        "SAM",  # Special Air Mission (VIP)
        "VENUS", "EXEC",  # Executive flights
        "BOXER", "BISON",  # Military
        "HAWK", "EAGLE", "VIPER",
        "COBRA", "PYTHON",
        "TOPCAT", "OTTER",
        "ROCKY", "STONE",
        "DEMON", "GHOST",
        "SKULL", "REAPER",
        "DOOM", "RAGE",
        "BONE",  # B-1B nickname
        "DOOM", "HAVOC",
        # NATO
        "NATO", "OTAN",
        # UK
        "ASCOT",  # RAF Transport
        "RAF", "RRR",  # RAF callsigns
        "TARTAN",  # RAF Poseidon
        # French
        "CTM", "COTAM",  # French AF Transport
        "FAF",  # French AF
        # German
        "GAF",  # German AF
        # Coast Guard/Emergency
        "COAST", "USCG", "CG",
        "RESCUE", "PEDRO",  # CSAR
        # USAF Special
        "KING", "JOLLY",  # HH-60 rescue
        "MOOSE",  # C-17
        "PACK",  # Wolfpack
    ]
    
    # Interesting squawk codes
    INTERESTING_SQUAWKS = {
        "7500": "Hijacking",
        "7600": "Radio failure", 
        "7700": "Emergency",
        "7777": "Military intercept",
        "0000": "Discrete code (military)",
        "4000": "VFR Special",
    }
    
    # Rare/unique aircraft to watch (ICAO hex codes or patterns)
    RARE_AIRCRAFT = [
        # NASA
        "NASA",
        # NOAA Hurricane Hunters
        "NOAA", "TEAL",
        # Interesting civilian
        "TEST", "EXPERIMENTAL",
    ]
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        """Fetch interesting aircraft data"""
        articles = []
        config = source.config or {}
        
        # Use OpenSky Network (free, no API key needed)
        try:
            # Get military aircraft in specified bounds or globally
            bounds = config.get("bounds", {"lat_min": 24, "lat_max": 50, "lon_min": -125, "lon_max": -66})  # Default: CONUS
            
            url = f"{self.ADSB_FREE_API}/states/all"
            params = {
                "lamin": bounds.get("lat_min", 24),
                "lamax": bounds.get("lat_max", 50),
                "lomin": bounds.get("lon_min", -125),
                "lomax": bounds.get("lon_max", -66),
            }
            
            response = await self.http_client.get(url, params=params, timeout=30.0)
            
            if response.status_code == 200:
                data = response.json()
                states = data.get("states", [])
                
                for state in states:
                    if not state:
                        continue
                    
                    icao = state[0]
                    callsign = (state[1] or "").strip()
                    origin_country = state[2]
                    longitude = state[5]
                    latitude = state[6]
                    altitude = state[7]  # meters
                    velocity = state[9]  # m/s
                    heading = state[10]
                    vertical_rate = state[11]
                    squawk = state[14]
                    
                    # Check if interesting
                    is_interesting = False
                    interest_reason = None
                    interest_category = "military"
                    
                    callsign_upper = callsign.upper() if callsign else ""
                    
                    # Check military callsigns/type codes
                    if callsign_upper:
                        for mil_type in self.MILITARY_TYPES:
                            if mil_type in callsign_upper:
                                is_interesting = True
                                interest_reason = f"Military aircraft: {callsign}"
                                break
                        
                        # Check military prefixes
                        if not is_interesting:
                            for prefix in self.MILITARY_PREFIXES:
                                if callsign_upper.startswith(prefix):
                                    is_interesting = True
                                    interest_reason = f"Military/Gov flight: {callsign}"
                                    break
                        
                        # Check rare/unique callsigns
                        if not is_interesting:
                            for rare in self.RARE_AIRCRAFT:
                                if rare in callsign_upper:
                                    is_interesting = True
                                    interest_reason = f"Special aircraft: {callsign}"
                                    interest_category = "surveillance"
                                    break
                    
                    # Check emergency squawks - ALWAYS interesting
                    if squawk and str(squawk) in self.INTERESTING_SQUAWKS:
                        is_interesting = True
                        interest_reason = f"🚨 {self.INTERESTING_SQUAWKS[str(squawk)]}: {callsign or icao}"
                        interest_category = "emergency"
                    
                    # Check for military origin countries with no callsigns (stealth mode)
                    if not is_interesting and not callsign and origin_country in [
                        "United States", "Russia", "China", "Israel", "Iran", 
                        "United Kingdom", "France", "Germany"
                    ]:
                        # Aircraft with no callsign from military nations could be interesting
                        if altitude and altitude > 10000:  # High altitude
                            is_interesting = True
                            interest_reason = f"Unidentified high-alt ({origin_country})"
                            interest_category = "surveillance"
                    
                    if is_interesting and latitude and longitude:
                        alt_ft = int((altitude or 0) * 3.28084)
                        speed_kts = int((velocity or 0) * 1.94384)
                        
                        articles.append({
                            "title": f"✈️ {interest_reason}",
                            "link": f"https://globe.adsbexchange.com/?icao={icao}",
                            "summary": f"ICAO: {icao} | Alt: {alt_ft:,}ft | Speed: {speed_kts}kts | Heading: {heading}° | Origin: {origin_country}",
                            "latitude": latitude,
                            "longitude": longitude,
                            "country": origin_country,
                            "published_at": datetime.utcnow(),
                            # Extra metadata
                            "icao": icao,
                            "callsign": callsign,
                            "altitude": alt_ft,
                            "velocity": speed_kts,
                            "heading": heading,
                            "squawk": squawk,
                            "category": interest_category,
                        })
            
            logger.info(f"ADS-B collected {len(articles)} interesting aircraft")
            
        except Exception as e:
            logger.error(f"ADS-B fetch error: {e}")
        
        return articles


class CustomRSSCollector(BaseCollector):
    """Custom RSS with user-defined filtering and keywords"""
    
    source_type = "custom_rss"
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        articles = []
        config = source.config or {}
        
        keywords = config.get("keywords", [])  # Filter to only these keywords
        exclude_keywords = config.get("exclude_keywords", [])
        
        try:
            logger.info(f"Custom RSS fetching: {source.url}")
            response = await self.http_client.get(source.url)
            feed = feedparser.parse(response.text)
            
            for entry in feed.entries[:50]:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                text = f"{title} {summary}".lower()
                
                # Apply keyword filters
                if keywords:
                    if not any(kw.lower() in text for kw in keywords):
                        continue
                
                if exclude_keywords:
                    if any(kw.lower() in text for kw in exclude_keywords):
                        continue
                
                published = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6])
                
                articles.append({
                    "title": title,
                    "link": entry.get("link", ""),
                    "summary": summary[:2000] if summary else None,
                    "published_at": published,
                })
            
            logger.info(f"Custom RSS collected {len(articles)} articles from {source.name}")
            
        except Exception as e:
            logger.error(f"Custom RSS fetch error for {source.name}: {e}")
        
        return articles


class ACARSCollector(BaseCollector):
    """
    ACARS (Aircraft Communications Addressing and Reporting System) collector
    Tracks aircraft communication messages and positions
    """
    
    source_type = "acars"
    
    # ACARS message types to track
    INTERESTING_MSG_TYPES = [
        "MAINT",      # Maintenance messages
        "TECH",       # Technical messages  
        "OPS",        # Operations
        "WEATHER",    # Weather/turbulence
        "EMERGENCY",  # Emergencies
        "DIVERT",     # Diversions
        "FUEL",       # Fuel issues
        "MEDICAL",    # Medical emergencies
        "SECURITY",   # Security
    ]
    
    async def fetch(self, source: Source) -> List[Dict[str, Any]]:
        """Fetch ACARS data from available sources"""
        articles = []
        config = source.config or {}
        
        try:
            # Try ACARShub free API (if available)
            url = "https://www.acarshub.org/api/acars"  # Example free ACARS feed
            
            try:
                response = await self.http_client.get(url, timeout=15.0)
                
                if response.status_code == 200:
                    data = response.json()
                    messages = data.get("messages", []) if isinstance(data, dict) else data
                    
                    for msg in messages[:50]:  # Limit to 50 recent messages
                        if not isinstance(msg, dict):
                            continue
                        
                        # Parse ACARS message fields
                        flight = (msg.get("flight") or "").upper()
                        msg_type = msg.get("type", "").upper()
                        text = msg.get("text", "") or msg.get("message", "")
                        altitude = msg.get("altitude", 0)
                        latitude = msg.get("latitude", 0)
                        longitude = msg.get("longitude", 0)
                        timestamp = msg.get("timestamp", datetime.utcnow().isoformat())
                        
                        # Determine severity based on message type/content
                        severity = "low"
                        is_interesting = False
                        category = "aviation"
                        
                        # Check for critical keywords in message
                        text_upper = text.upper() if text else ""
                        
                        if any(keyword in text_upper for keyword in ["EMERGENCY", "DIVERT", "MEDICAL", "SECURITY"]):
                            severity = "critical"
                            is_interesting = True
                        elif any(keyword in text_upper for keyword in ["FUEL", "HYDRAULIC", "ENGINE", "ELECTRICAL"]):
                            severity = "high"
                            is_interesting = True
                        elif msg_type in self.INTERESTING_MSG_TYPES:
                            severity = "medium" if msg_type in ["MAINT", "TECH"] else "low"
                            is_interesting = True
                        
                        if is_interesting and flight and latitude and longitude:
                            articles.append({
                                "title": f"✈️ ACARS: {flight} - {msg_type}",
                                "summary": text[:200] if text else f"ACARS {msg_type} message from {flight}",
                                "link": f"https://www.acarshub.org/",
                                "published_at": datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else datetime.utcnow(),
                                "source": source.name,
                                "category": category,
                                "severity": severity,
                                "latitude": latitude,
                                "longitude": longitude,
                                # Extra metadata
                                "flight": flight,
                                "msg_type": msg_type,
                                "altitude": altitude,
                            })
                
                logger.info(f"ACARS collected {len(articles)} messages")
                
            except Exception as e:
                logger.warning(f"ACARS API fetch failed: {e}")
                logger.info("ACARS collector running but API unavailable - using fallback mode")
        
        except Exception as e:
            logger.error(f"ACARS fetch error: {e}")
        
        return articles


# Collector registry
COLLECTORS = {
    "rss": RSSCollector,
    "gdelt": GDELTCollector,
    "reddit": RedditCollector,
    "bluesky": BlueskyCollector,
    "telegram": TelegramCollector,
    "adsb": ADSBCollector,
    "acars": ACARSCollector,
    "custom_rss": CustomRSSCollector,
}


def get_collector(source_type: str, session: AsyncSession) -> BaseCollector:
    """Factory function to get appropriate collector"""
    collector_class = COLLECTORS.get(source_type, RSSCollector)
    return collector_class(session)
