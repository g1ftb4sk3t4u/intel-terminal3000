"""
Intel Terminal 1000 - Geolocation Service
Extracts locations from text and geocodes them
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import GeoCache, Article
from .config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Major cities and countries for quick matching (no API needed)
KNOWN_LOCATIONS = {
    # Major countries
    "united states": (39.8283, -98.5795, "United States", "North America"),
    "usa": (39.8283, -98.5795, "United States", "North America"),
    "russia": (61.5240, 105.3188, "Russia", "Europe/Asia"),
    "china": (35.8617, 104.1954, "China", "Asia"),
    "ukraine": (48.3794, 31.1656, "Ukraine", "Europe"),
    "iran": (32.4279, 53.6880, "Iran", "Middle East"),
    "israel": (31.0461, 34.8516, "Israel", "Middle East"),
    "north korea": (40.3399, 127.5101, "North Korea", "Asia"),
    "taiwan": (23.6978, 120.9605, "Taiwan", "Asia"),
    "india": (20.5937, 78.9629, "India", "Asia"),
    "pakistan": (30.3753, 69.3451, "Pakistan", "Asia"),
    "germany": (51.1657, 10.4515, "Germany", "Europe"),
    "france": (46.2276, 2.2137, "France", "Europe"),
    "uk": (55.3781, -3.4360, "United Kingdom", "Europe"),
    "united kingdom": (55.3781, -3.4360, "United Kingdom", "Europe"),
    "japan": (36.2048, 138.2529, "Japan", "Asia"),
    "south korea": (35.9078, 127.7669, "South Korea", "Asia"),
    "saudi arabia": (23.8859, 45.0792, "Saudi Arabia", "Middle East"),
    "syria": (34.8021, 38.9968, "Syria", "Middle East"),
    "iraq": (33.2232, 43.6793, "Iraq", "Middle East"),
    "afghanistan": (33.9391, 67.7100, "Afghanistan", "Asia"),
    "brazil": (-14.2350, -51.9253, "Brazil", "South America"),
    "mexico": (23.6345, -102.5528, "Mexico", "North America"),
    "canada": (56.1304, -106.3468, "Canada", "North America"),
    "australia": (-25.2744, 133.7751, "Australia", "Oceania"),
    
    # Major cities
    "moscow": (55.7558, 37.6173, "Russia", "Europe"),
    "kyiv": (50.4501, 30.5234, "Ukraine", "Europe"),
    "kiev": (50.4501, 30.5234, "Ukraine", "Europe"),
    "beijing": (39.9042, 116.4074, "China", "Asia"),
    "washington": (38.9072, -77.0369, "United States", "North America"),
    "washington dc": (38.9072, -77.0369, "United States", "North America"),
    "new york": (40.7128, -74.0060, "United States", "North America"),
    "london": (51.5074, -0.1278, "United Kingdom", "Europe"),
    "paris": (48.8566, 2.3522, "France", "Europe"),
    "berlin": (52.5200, 13.4050, "Germany", "Europe"),
    "tokyo": (35.6762, 139.6503, "Japan", "Asia"),
    "seoul": (37.5665, 126.9780, "South Korea", "Asia"),
    "tehran": (35.6892, 51.3890, "Iran", "Middle East"),
    "tel aviv": (32.0853, 34.7818, "Israel", "Middle East"),
    "jerusalem": (31.7683, 35.2137, "Israel", "Middle East"),
    "gaza": (31.5017, 34.4668, "Palestine", "Middle East"),
    "taipei": (25.0330, 121.5654, "Taiwan", "Asia"),
    "hong kong": (22.3193, 114.1694, "China", "Asia"),
    "singapore": (1.3521, 103.8198, "Singapore", "Asia"),
    "dubai": (25.2048, 55.2708, "UAE", "Middle East"),
    "riyadh": (24.7136, 46.6753, "Saudi Arabia", "Middle East"),
    "damascus": (33.5138, 36.2765, "Syria", "Middle East"),
    "baghdad": (33.3152, 44.3661, "Iraq", "Middle East"),
    "kabul": (34.5553, 69.2075, "Afghanistan", "Asia"),
    "islamabad": (33.6844, 73.0479, "Pakistan", "Asia"),
    "new delhi": (28.6139, 77.2090, "India", "Asia"),
    "mumbai": (19.0760, 72.8777, "India", "Asia"),
    "brussels": (50.8503, 4.3517, "Belgium", "Europe"),
    "geneva": (46.2044, 6.1432, "Switzerland", "Europe"),
    "cairo": (30.0444, 31.2357, "Egypt", "Africa"),
    "johannesburg": (-26.2041, 28.0473, "South Africa", "Africa"),
    "nairobi": (-1.2921, 36.8219, "Kenya", "Africa"),
    "lagos": (6.5244, 3.3792, "Nigeria", "Africa"),
    "ankara": (39.9334, 32.8597, "Turkey", "Europe/Asia"),
    "istanbul": (41.0082, 28.9784, "Turkey", "Europe/Asia"),
    "minsk": (53.9045, 27.5615, "Belarus", "Europe"),
    "warsaw": (52.2297, 21.0122, "Poland", "Europe"),
}

# Region mapping for heat map grouping
REGIONS = {
    "North America": {"lat": 45, "lon": -100, "color": "#3b82f6"},
    "South America": {"lat": -15, "lon": -60, "color": "#22c55e"},
    "Europe": {"lat": 50, "lon": 10, "color": "#8b5cf6"},
    "Africa": {"lat": 0, "lon": 20, "color": "#f59e0b"},
    "Middle East": {"lat": 30, "lon": 45, "color": "#ef4444"},
    "Asia": {"lat": 35, "lon": 100, "color": "#ec4899"},
    "Oceania": {"lat": -25, "lon": 140, "color": "#06b6d4"},
    "Europe/Asia": {"lat": 45, "lon": 40, "color": "#a855f7"},
}


class GeoService:
    """Service for extracting and geocoding locations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.http_client = httpx.AsyncClient(timeout=10.0)
        self.nominatim_url = "https://nominatim.openstreetmap.org/search"
    
    async def extract_locations(self, text: str) -> List[str]:
        """
        Extract location names from text using pattern matching.
        For better accuracy, use spaCy NER (but requires download).
        """
        if not text:
            return []
        
        found_locations = []
        text_lower = text.lower()
        
        # Check against known locations
        for location in KNOWN_LOCATIONS.keys():
            # Word boundary matching
            pattern = r'\b' + re.escape(location) + r'\b'
            if re.search(pattern, text_lower):
                found_locations.append(location)
        
        # Deduplicate while preserving order
        seen = set()
        unique_locations = []
        for loc in found_locations:
            if loc not in seen:
                seen.add(loc)
                unique_locations.append(loc)
        
        return unique_locations[:5]  # Limit to 5 locations
    
    async def geocode(self, location: str) -> Optional[Dict[str, Any]]:
        """
        Geocode a location name to coordinates.
        First checks known locations, then cache, then Nominatim API.
        """
        location_lower = location.lower()
        
        # Check known locations first (instant)
        if location_lower in KNOWN_LOCATIONS:
            lat, lon, country, region = KNOWN_LOCATIONS[location_lower]
            return {
                "latitude": lat,
                "longitude": lon,
                "country": country,
                "region": region,
            }
        
        # Check cache
        cached = await self.session.execute(
            select(GeoCache).where(GeoCache.location_name == location_lower)
        )
        cached_result = cached.scalar_one_or_none()
        
        if cached_result:
            return {
                "latitude": cached_result.latitude,
                "longitude": cached_result.longitude,
                "country": cached_result.country,
                "region": cached_result.region,
            }
        
        # Call Nominatim API (rate limited - be respectful)
        try:
            response = await self.http_client.get(
                self.nominatim_url,
                params={
                    "q": location,
                    "format": "json",
                    "limit": 1,
                },
                headers={"User-Agent": "IntelTerminal1000/1.0"}
            )
            
            results = response.json()
            if results:
                result = results[0]
                lat = float(result["lat"])
                lon = float(result["lon"])
                
                # Determine region from coordinates
                region = self._determine_region(lat, lon)
                country = result.get("display_name", "").split(",")[-1].strip()
                
                # Cache the result
                cache_entry = GeoCache(
                    location_name=location_lower,
                    latitude=lat,
                    longitude=lon,
                    country=country,
                    region=region,
                )
                self.session.add(cache_entry)
                await self.session.commit()
                
                return {
                    "latitude": lat,
                    "longitude": lon,
                    "country": country,
                    "region": region,
                }
                
        except Exception as e:
            logger.warning(f"Geocoding failed for {location}: {e}")
        
        return None
    
    def _determine_region(self, lat: float, lon: float) -> str:
        """Determine region from coordinates (rough approximation)"""
        if lat > 15 and lon < -30:
            return "North America"
        elif lat < 15 and lon < -30:
            return "South America"
        elif lat > 35 and lon > -30 and lon < 60:
            return "Europe"
        elif lat < 35 and lat > -40 and lon > -20 and lon < 55:
            return "Africa"
        elif lat > 10 and lat < 45 and lon > 25 and lon < 65:
            return "Middle East"
        elif lon > 60 or (lat > 0 and lon > 100):
            return "Asia"
        elif lat < 0 and lon > 100:
            return "Oceania"
        return "Unknown"
    
    async def process_article(self, article: Article) -> Article:
        """Extract locations and geocode for an article"""
        text = f"{article.title} {article.summary or ''}"
        
        locations = await self.extract_locations(text)
        
        if locations:
            article.locations = locations
            article.primary_location = locations[0]
            
            # Geocode primary location
            geo_data = await self.geocode(locations[0])
            if geo_data:
                article.latitude = geo_data["latitude"]
                article.longitude = geo_data["longitude"]
                article.country = geo_data["country"]
                article.region = geo_data["region"]
        
        return article
    
    async def get_heat_map_data(self) -> List[Dict[str, Any]]:
        """Get aggregated location data for heat map"""
        # Query articles with location data
        result = await self.session.execute(
            select(Article)
            .where(Article.latitude.isnot(None))
            .where(Article.longitude.isnot(None))
            .order_by(Article.created_at.desc())
            .limit(500)
        )
        articles = result.scalars().all()
        
        # Aggregate by region
        region_counts = {}
        points = []
        
        for article in articles:
            region = article.region or "Unknown"
            if region not in region_counts:
                region_counts[region] = 0
            region_counts[region] += 1
            
            # Calculate intensity based on severity
            intensity = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.2}.get(
                article.severity, 0.2
            )
            
            points.append({
                "lat": article.latitude,
                "lon": article.longitude,
                "intensity": intensity,
                "title": article.title,
                "severity": article.severity,
                "id": article.id,
                "link": article.link,
                "region": article.region,
            })
        
        return {
            "points": points,
            "regions": region_counts,
            "region_info": REGIONS,
        }
    
    async def close(self):
        await self.http_client.aclose()
