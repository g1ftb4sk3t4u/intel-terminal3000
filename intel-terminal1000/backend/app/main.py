"""
Intel Terminal 1000 - Main FastAPI Application
Multi-dashboard intelligence platform with real-time data aggregation
"""
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import asyncio
import json
import logging

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .database import init_db, get_db, AsyncSessionLocal
from .models import Article, Source, Dashboard, Hashtag, Alert, TriageKeyword, TrendingAlert, AircraftTrack
from .collectors import get_collector, COLLECTORS, ADSBCollector
from .geolocation import GeoService
from .triage import TriageService, seed_default_keywords
from .trending import TrendingDetector
from .config import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
scheduler = AsyncIOScheduler()


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


async def fetch_all_sources():
    """Background task to fetch from all enabled sources"""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(Source).where(Source.enabled == True)
            )
            sources = result.scalars().all()
            
            for source in sources:
                try:
                    collector = get_collector(source.source_type, session)
                    articles_data = await collector.fetch(source)
                    
                    if articles_data:
                        # Process each article
                        geo_service = GeoService(session)
                        triage_service = TriageService()
                        
                        for article_data in articles_data:
                            # Check duplicate
                            existing = await session.execute(
                                select(Article).where(Article.link == article_data["link"])
                            )
                            if existing.scalar_one_or_none():
                                continue
                            
                            # Create article
                            article = Article(
                                title=article_data.get("title", "Untitled")[:500],
                                link=article_data["link"],
                                summary=article_data.get("summary"),
                                content=article_data.get("content"),
                                source=source.name,
                                source_type=source.source_type,
                                source_url=source.url,
                                category=source.category,
                                published_at=article_data.get("published_at"),
                                country=article_data.get("country"),
                                region=article_data.get("region"),
                                latitude=article_data.get("latitude"),
                                longitude=article_data.get("longitude"),
                            )
                            
                            # Triage
                            triage_result = await triage_service.triage(
                                article.title,
                                article.summary or ""
                            )
                            article.severity = triage_result["severity"]
                            
                            # Geolocation (if not already set)
                            if not article.latitude:
                                article = await geo_service.process_article(article)
                            
                            session.add(article)
                            
                            # Notify WebSocket clients
                            await manager.broadcast({
                                "type": "new_article",
                                "article": {
                                    "id": 0,  # Will be set after commit
                                    "title": article.title,
                                    "source": article.source,
                                    "severity": article.severity,
                                    "category": article.category,
                                },
                            })
                        
                        await session.commit()
                        await geo_service.close()
                        await triage_service.close()
                    
                    # Update last fetched
                    source.last_fetched = datetime.utcnow()
                    source.error_count = 0
                    await session.commit()
                    
                    await collector.close()
                    
                except Exception as e:
                    logger.error(f"Error fetching {source.name}: {e}")
                    source.error_count += 1
                    await session.commit()
                    
        except Exception as e:
            logger.error(f"Fetch all sources error: {e}")


async def run_trending_detection():
    """Background task to detect trending topics and spikes"""
    async with AsyncSessionLocal() as session:
        try:
            detector = TrendingDetector(session)
            alerts = await detector.run_all_detections()
            
            if alerts:
                logger.info(f"🚨 Generated {len(alerts)} trending alerts")
                # Broadcast to WebSocket clients
                for alert in alerts:
                    await manager.broadcast({
                        "type": "trending_alert",
                        "alert": {
                            "id": alert.id,
                            "alert_type": alert.alert_type,
                            "region": alert.region,
                            "country": alert.country,
                            "keyword": alert.keyword,
                            "severity": alert.severity,
                            "article_count": alert.article_count,
                            "spike_percentage": alert.spike_percentage,
                        }
                    })
        except Exception as e:
            logger.error(f"Trending detection error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await init_db()
    logger.info("Database initialized")
    
    # Seed default keywords
    async with AsyncSessionLocal() as session:
        await seed_default_keywords(session)
    
    # Start background scheduler
    scheduler.add_job(
        fetch_all_sources,
        'interval',
        seconds=settings.rss_fetch_interval,
        id='fetch_sources',
        replace_existing=True,
    )
    scheduler.add_job(
        run_trending_detection,
        'interval',
        minutes=10,  # Check for trends every 10 minutes
        id='trending_detection',
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Background scheduler started (fetch + trending)")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler shutdown")


# Create FastAPI app
app = FastAPI(
    title="Intel Terminal 1000",
    description="Multi-dashboard intelligence aggregation platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== ARTICLES ENDPOINTS ==========

@app.get("/api/articles")
async def get_articles(
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = None,
    severity: Optional[str] = None,
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    starred: Optional[bool] = None,
):
    """Get articles with filtering"""
    query = select(Article).order_by(desc(Article.created_at))
    
    filters = []
    if category:
        filters.append(Article.category == category)
    if severity:
        filters.append(Article.severity == severity)
    if source_type:
        filters.append(Article.source_type == source_type)
    if region:
        filters.append(Article.region == region)
    if starred is not None:
        filters.append(Article.is_starred == starred)
    if search:
        filters.append(
            or_(
                Article.title.ilike(f"%{search}%"),
                Article.summary.ilike(f"%{search}%"),
            )
        )
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    articles = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "title": a.title,
            "link": a.link,
            "summary": a.summary[:300] if a.summary else None,
            "source": a.source,
            "source_type": a.source_type,
            "category": a.category,
            "severity": a.severity,
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "latitude": a.latitude,
            "longitude": a.longitude,
            "region": a.region,
            "country": a.country,
            "is_starred": a.is_starred,
            "is_read": a.is_read,
        }
        for a in articles
    ]


@app.get("/api/articles/{article_id}")
async def get_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """Get single article by ID"""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@app.patch("/api/articles/{article_id}")
async def update_article(
    article_id: int,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Update article (severity, starred, read, etc.)"""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    allowed_fields = ["severity", "is_starred", "is_read", "is_archived", "manually_triaged"]
    for field, value in updates.items():
        if field in allowed_fields:
            setattr(article, field, value)
    
    if updates.get("severity"):
        article.manually_triaged = True
    
    await db.commit()
    return {"status": "updated"}


# ========== SOURCES ENDPOINTS ==========

@app.get("/api/sources")
async def get_sources(db: AsyncSession = Depends(get_db)):
    """Get all configured sources"""
    result = await db.execute(select(Source).order_by(Source.name))
    sources = result.scalars().all()
    return sources


@app.post("/api/sources")
async def create_source(source_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Create a new data source"""
    source = Source(
        name=source_data["name"],
        url=source_data.get("url"),
        source_type=source_data["source_type"],
        category=source_data.get("category"),
        config=source_data.get("config"),
        enabled=source_data.get("enabled", True),
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


@app.delete("/api/sources/{source_id}")
async def delete_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a source"""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "deleted"}


@app.post("/api/sources/{source_id}/fetch")
async def fetch_source_now(source_id: int, db: AsyncSession = Depends(get_db)):
    """Manually trigger fetch for a source"""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    collector = get_collector(source.source_type, db)
    articles = await collector.fetch(source)
    saved = await collector.save_articles(articles, source)
    await collector.close()
    
    source.last_fetched = datetime.utcnow()
    await db.commit()
    
    return {"fetched": len(articles), "saved": saved}


# ========== DASHBOARD ENDPOINTS ==========

@app.get("/api/dashboards")
async def get_dashboards(db: AsyncSession = Depends(get_db)):
    """Get all dashboards"""
    result = await db.execute(select(Dashboard).order_by(Dashboard.name))
    dashboards = result.scalars().all()
    return dashboards


@app.post("/api/dashboards")
async def create_dashboard(dashboard_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Create a new dashboard"""
    dashboard = Dashboard(
        name=dashboard_data["name"],
        description=dashboard_data.get("description"),
        layout=dashboard_data.get("layout", "2x2"),
        panels=dashboard_data.get("panels", []),
        is_default=dashboard_data.get("is_default", False),
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)
    return dashboard


@app.put("/api/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: int,
    dashboard_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Update a dashboard"""
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    for field in ["name", "description", "layout", "panels", "is_default"]:
        if field in dashboard_data:
            setattr(dashboard, field, dashboard_data[field])
    
    dashboard.updated_at = datetime.utcnow()
    await db.commit()
    return dashboard


@app.delete("/api/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a dashboard"""
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.delete(dashboard)
    await db.commit()
    return {"status": "deleted"}


# ========== MAP/GEO ENDPOINTS ==========

@app.get("/api/map/heatmap")
async def get_heatmap_data(
    db: AsyncSession = Depends(get_db),
    hours: int = Query(24, description="Hours to look back"),
    severity: Optional[str] = None,
    category: Optional[str] = None,
):
    """Get heat map data for visualization"""
    geo_service = GeoService(db)
    # Query articles with location data and filters
    from sqlalchemy import and_
    query = select(Article)
    query = query.where(Article.latitude.isnot(None)).where(Article.longitude.isnot(None))
    if severity:
        query = query.where(Article.severity == severity)
    if category:
        query = query.where(Article.category == category)
    query = query.order_by(Article.created_at.desc()).limit(500)
    result = await db.execute(query)
    articles = result.scalars().all()
    # Aggregate by region
    region_counts = {}
    points = []
    for article in articles:
        region = article.region or "Unknown"
        if region not in region_counts:
            region_counts[region] = 0
        region_counts[region] += 1
        intensity = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.2}.get(article.severity, 0.2)
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
    await geo_service.close()
    return {
        "points": points,
        "regions": region_counts,
        "region_info": geo_service.REGIONS,
    }


@app.get("/api/map/regions")
async def get_region_stats(db: AsyncSession = Depends(get_db)):
    """Get article counts by region"""
    result = await db.execute(
        select(Article.region, func.count(Article.id))
        .where(Article.region.isnot(None))
        .group_by(Article.region)
    )
    return dict(result.all())


# ========== STATS ENDPOINTS ==========

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get overall statistics"""
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    
    # Total counts
    total = await db.execute(select(func.count(Article.id)))
    total_count = total.scalar()
    
    # Last 24 hours
    recent = await db.execute(
        select(func.count(Article.id)).where(Article.created_at >= day_ago)
    )
    recent_count = recent.scalar()
    
    # By severity
    severity_result = await db.execute(
        select(Article.severity, func.count(Article.id))
        .group_by(Article.severity)
    )
    by_severity = dict(severity_result.all())
    
    # By source type
    source_result = await db.execute(
        select(Article.source_type, func.count(Article.id))
        .group_by(Article.source_type)
    )
    by_source_type = dict(source_result.all())
    
    # By category
    category_result = await db.execute(
        select(Article.category, func.count(Article.id))
        .where(Article.category.isnot(None))
        .group_by(Article.category)
    )
    by_category = dict(category_result.all())
    
    return {
        "total_articles": total_count,
        "last_24h": recent_count,
        "by_severity": by_severity,
        "by_source_type": by_source_type,
        "by_category": by_category,
    }


@app.get("/api/stats/timeline")
async def get_timeline_stats(
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, le=30),
):
    """Get article counts over time for charts"""
    now = datetime.utcnow()
    data = []
    
    for i in range(days, -1, -1):
        date = now - timedelta(days=i)
        start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        
        count_result = await db.execute(
            select(func.count(Article.id))
            .where(and_(Article.created_at >= start, Article.created_at < end))
        )
        count = count_result.scalar()
        
        data.append({
            "date": start.strftime("%Y-%m-%d"),
            "count": count,
        })
    
    return data


# ========== ALERTS ENDPOINTS ==========

@app.get("/api/alerts")
async def get_alerts(db: AsyncSession = Depends(get_db)):
    """Get all alert rules"""
    result = await db.execute(select(Alert).order_by(Alert.name))
    return result.scalars().all()


@app.post("/api/alerts")
async def create_alert(alert_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Create an alert rule"""
    alert = Alert(
        name=alert_data["name"],
        conditions=alert_data.get("conditions", {}),
        discord_notify=alert_data.get("discord_notify", False),
        sound_notify=alert_data.get("sound_notify", True),
        enabled=alert_data.get("enabled", True),
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


# ========== TRENDING ALERTS ENDPOINTS ==========

@app.get("/api/trending")
async def get_trending_alerts(db: AsyncSession = Depends(get_db)):
    """Get active trending alerts (regional spikes, keyword surges, etc.)"""
    detector = TrendingDetector(db)
    alerts = await detector.get_active_alerts()
    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "region": a.region,
            "country": a.country,
            "keyword": a.keyword,
            "article_count": a.article_count,
            "previous_count": a.previous_count,
            "spike_percentage": a.spike_percentage,
            "sample_articles": a.sample_articles,
            "severity": a.severity,
            "is_acknowledged": a.is_acknowledged,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        }
        for a in alerts
    ]


@app.post("/api/trending/{alert_id}/acknowledge")
async def acknowledge_trending_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Acknowledge a trending alert"""
    detector = TrendingDetector(db)
    await detector.acknowledge_alert(alert_id)
    return {"status": "acknowledged"}


@app.post("/api/trending/detect")
async def trigger_trending_detection(db: AsyncSession = Depends(get_db)):
    """Manually trigger trending detection"""
    detector = TrendingDetector(db)
    alerts = await detector.run_all_detections()
    return {
        "detected": len(alerts),
        "alerts": [
            {
                "alert_type": a.alert_type,
                "region": a.region or a.country,
                "keyword": a.keyword,
                "severity": a.severity,
                "article_count": a.article_count,
            }
            for a in alerts
        ]
    }


# ========== KEYWORDS ENDPOINTS ==========

@app.get("/api/keywords")
async def get_keywords(db: AsyncSession = Depends(get_db)):
    """Get all triage keywords"""
    result = await db.execute(select(TriageKeyword).order_by(TriageKeyword.severity, TriageKeyword.keyword))
    return result.scalars().all()


@app.post("/api/keywords")
async def create_keyword(keyword_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Create a new triage keyword"""
    keyword = TriageKeyword(
        keyword=keyword_data["keyword"],
        severity=keyword_data.get("severity", "medium"),
        weight=keyword_data.get("weight", 1),
        category=keyword_data.get("category"),
        is_regex=keyword_data.get("is_regex", False),
        description=keyword_data.get("description"),
        enabled=keyword_data.get("enabled", True),
    )
    db.add(keyword)
    await db.commit()
    await db.refresh(keyword)
    return keyword


@app.put("/api/keywords/{keyword_id}")
async def update_keyword(keyword_id: int, keyword_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update a triage keyword"""
    result = await db.execute(select(TriageKeyword).where(TriageKeyword.id == keyword_id))
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    for field in ["keyword", "severity", "weight", "category", "is_regex", "description", "enabled"]:
        if field in keyword_data:
            setattr(keyword, field, keyword_data[field])
    
    await db.commit()
    return keyword


@app.delete("/api/keywords/{keyword_id}")
async def delete_keyword(keyword_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a triage keyword"""
    result = await db.execute(select(TriageKeyword).where(TriageKeyword.id == keyword_id))
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    await db.delete(keyword)
    await db.commit()
    return {"status": "deleted"}


# ========== CUSTOM SOURCES ENDPOINTS ==========

@app.post("/api/sources/custom")
async def create_custom_source(source_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Create a custom RSS source with keyword filtering"""
    source = Source(
        name=source_data["name"],
        source_type="custom_rss",
        url=source_data["url"],
        category=source_data.get("category", "custom"),
        region=source_data.get("region"),
        enabled=source_data.get("enabled", True),
        config={
            "keywords": source_data.get("keywords", []),
            "exclude_keywords": source_data.get("exclude_keywords", []),
            "require_all_keywords": source_data.get("require_all_keywords", False),
        }
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


@app.get("/api/sources/custom")
async def get_custom_sources(db: AsyncSession = Depends(get_db)):
    """Get all custom sources"""
    result = await db.execute(
        select(Source).where(Source.source_type == "custom_rss").order_by(Source.name)
    )
    sources = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "category": s.category,
            "region": s.region,
            "enabled": s.enabled,
            "keywords": s.config.get("keywords", []) if s.config else [],
            "exclude_keywords": s.config.get("exclude_keywords", []) if s.config else [],
            "require_all_keywords": s.config.get("require_all_keywords", False) if s.config else False,
        }
        for s in sources
    ]


@app.put("/api/sources/custom/{source_id}")
async def update_custom_source(source_id: int, source_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update a custom source"""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source or source.source_type != "custom_rss":
        raise HTTPException(status_code=404, detail="Custom source not found")
    
    if "name" in source_data:
        source.name = source_data["name"]
    if "url" in source_data:
        source.url = source_data["url"]
    if "category" in source_data:
        source.category = source_data["category"]
    if "region" in source_data:
        source.region = source_data["region"]
    if "enabled" in source_data:
        source.enabled = source_data["enabled"]
    
    # Update config
    config = source.config or {}
    if "keywords" in source_data:
        config["keywords"] = source_data["keywords"]
    if "exclude_keywords" in source_data:
        config["exclude_keywords"] = source_data["exclude_keywords"]
    if "require_all_keywords" in source_data:
        config["require_all_keywords"] = source_data["require_all_keywords"]
    source.config = config
    
    await db.commit()
    return source


@app.delete("/api/sources/custom/{source_id}")
async def delete_custom_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a custom source"""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source or source.source_type != "custom_rss":
        raise HTTPException(status_code=404, detail="Custom source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "deleted"}


# ========== AIRCRAFT TRACKING ENDPOINTS ==========

@app.get("/api/aircraft")
async def get_aircraft(db: AsyncSession = Depends(get_db)):
    """Get currently tracked aircraft"""
    # Get aircraft from last 30 minutes
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    result = await db.execute(
        select(AircraftTrack)
        .where(AircraftTrack.last_seen >= cutoff)
        .order_by(AircraftTrack.last_seen.desc())
    )
    return result.scalars().all()


@app.get("/api/aircraft/interesting")
async def get_interesting_aircraft(
    region: str = Query("global", description="Region: global, usa, europe, middle_east, asia"),
    db: AsyncSession = Depends(get_db)
):
    """Get aircraft of interest (military, surveillance, emergency) - LIVE data"""
    # Define region bounds
    REGION_BOUNDS = {
        "global": {"lat_min": -60, "lat_max": 70, "lon_min": -180, "lon_max": 180},
        "usa": {"lat_min": 24, "lat_max": 50, "lon_min": -125, "lon_max": -66},
        "europe": {"lat_min": 35, "lat_max": 72, "lon_min": -10, "lon_max": 40},
        "middle_east": {"lat_min": 12, "lat_max": 42, "lon_min": 30, "lon_max": 65},
        "asia": {"lat_min": -10, "lat_max": 55, "lon_min": 90, "lon_max": 160},
    }
    
    bounds = REGION_BOUNDS.get(region, REGION_BOUNDS["global"])
    
    # Fetch live data
    collector = ADSBCollector(db)
    
    from .models import Source
    mock_source = Source(
        name="Live Fetch",
        source_type="adsb",
        category="aviation",
        config={"bounds": bounds}
    )
    
    try:
        aircraft_data = await collector.fetch(mock_source)
        await collector.close()
        
        # Transform to match expected format
        return [
            {
                "icao24": a.get("icao", ""),
                "callsign": a.get("callsign", "") or "N/A",
                "origin_country": a.get("country", "Unknown"),
                "latitude": a.get("latitude"),
                "longitude": a.get("longitude"),
                "altitude": a.get("altitude", 0),
                "velocity": a.get("velocity", 0),
                "heading": a.get("heading"),
                "squawk": a.get("squawk"),
                "is_interesting": True,
                "aircraft_category": a.get("category", "military"),
                "title": a.get("title", ""),
                "link": a.get("link", ""),
            }
            for a in aircraft_data
        ]
    except Exception as e:
        logger.error(f"Aircraft fetch error: {e}")
        return []


@app.post("/api/aircraft/fetch")
async def trigger_aircraft_fetch(
    bounds: Dict[str, float] = None,
    db: AsyncSession = Depends(get_db)
):
    """Fetch aircraft data for a bounding box"""
    collector = ADSBCollector(db)
    
    if bounds:
        bbox = {
            "lat_min": bounds.get("south", 30.0),
            "lon_min": bounds.get("west", -10.0),
            "lat_max": bounds.get("north", 60.0),
            "lon_max": bounds.get("east", 40.0),
        }
    else:
        # Default: Europe/Middle East
        bbox = {"lat_min": 30.0, "lon_min": -10.0, "lat_max": 60.0, "lon_max": 40.0}
    
    # Create mock source with bounds config
    from .models import Source
    mock_source = Source(
        name="Manual Fetch",
        source_type="adsb",
        category="aviation",
        config={"bounds": bbox}
    )
    
    aircraft_articles = await collector.fetch(mock_source)
    await collector.close()
    
    return {
        "count": len(aircraft_articles),
        "interesting": len(aircraft_articles),  # All returned are interesting
        "aircraft": [
            {
                "icao24": a.get("icao", ""),
                "callsign": a.get("callsign", ""),
                "country": a.get("country", ""),
                "lat": a.get("latitude"),
                "lon": a.get("longitude"),
                "altitude": a.get("altitude"),
                "velocity": None,  # Converted to knots in title
                "is_interesting": True,
                "category": "military" if "Military" in a.get("title", "") else "surveillance",
                "title": a.get("title", ""),
                "link": a.get("link", ""),
            }
            for a in aircraft_articles[:50]  # Limit response
        ]
    }


# ========== DASHBOARD TEMPLATES ENDPOINTS ==========

DASHBOARD_TEMPLATES = {
    "ukraine_conflict": {
        "name": "Ukraine Conflict Monitor",
        "description": "Track the Russia-Ukraine war",
        "panels": 6,
        "layout": "3x2",
        "categories": ["Ukraine", "Russia", "NATO", "Military", "map", "trending"],
        "keywords": ["ukraine", "russia", "kyiv", "moscow", "zelensky", "putin", "nato", "wagner", "crimea", "donbas"],
        "region_focus": {"lat": 48.5, "lon": 31.5, "zoom": 5},
    },
    "middle_east": {
        "name": "Middle East Monitor",
        "description": "Track conflicts in the Middle East",
        "panels": 6,
        "layout": "3x2",
        "categories": ["Israel", "Gaza", "Iran", "Syria", "map", "trending"],
        "keywords": ["israel", "gaza", "hamas", "hezbollah", "iran", "syria", "lebanon", "idf", "tel aviv", "tehran"],
        "region_focus": {"lat": 32.0, "lon": 35.0, "zoom": 6},
    },
    "africa_security": {
        "name": "Africa Security",
        "description": "Track security across Africa",
        "panels": 4,
        "layout": "2x2",
        "categories": ["Sahel", "Eastern Africa", "map", "trending"],
        "keywords": ["coup", "wagner", "junta", "mali", "niger", "sudan", "ethiopia", "somalia", "boko haram", "al-shabaab"],
        "region_focus": {"lat": 5.0, "lon": 20.0, "zoom": 4},
    },
    "asia_pacific": {
        "name": "Asia Pacific Watch",
        "description": "Monitor Indo-Pacific tensions",
        "panels": 6,
        "layout": "3x2",
        "categories": ["China", "Taiwan", "North Korea", "South China Sea", "map", "trending"],
        "keywords": ["taiwan", "china", "xi jinping", "kim jong un", "dprk", "south china sea", "philippines", "japan", "india border"],
        "region_focus": {"lat": 30.0, "lon": 120.0, "zoom": 4},
    },
    "global_overview": {
        "name": "Global Intelligence Overview",
        "description": "Worldwide monitoring dashboard",
        "panels": 8,
        "layout": "4x2",
        "categories": ["Breaking", "Military", "Politics", "Economy", "Cyber", "map", "trending", "aircraft"],
        "keywords": [],
        "region_focus": {"lat": 20.0, "lon": 0.0, "zoom": 2},
    },
    # ===== NEW TEMPLATES =====
    "aircraft_tracker": {
        "name": "Aircraft Tracker",
        "description": "Focus on ADS-B aircraft tracking",
        "panels": 4,
        "layout": "2x2",
        "categories": ["aircraft", "aircraft", "map", "trending"],
        "keywords": [],
        "region_focus": {"lat": 40.0, "lon": 10.0, "zoom": 4},
        "aircraft_filters": {"interesting_only": True},
    },
    "emergency_squawks": {
        "name": "Emergency Squawks",
        "description": "Monitor emergency aircraft (7500/7600/7700)",
        "panels": 2,
        "layout": "2x1",
        "categories": ["aircraft", "map"],
        "keywords": [],
        "region_focus": {"lat": 45.0, "lon": -95.0, "zoom": 4},
        "aircraft_filters": {"squawks": ["7500", "7600", "7700"]},
    },
    "europe_map": {
        "name": "Europe Live Map",
        "description": "Interactive map of European events",
        "panels": 2,
        "layout": "2x1",
        "categories": ["map", "trending"],
        "keywords": [],
        "region_focus": {"lat": 50.0, "lon": 10.0, "zoom": 4},
    },
    "usa_map": {
        "name": "USA Live Map",
        "description": "Interactive map of US events",
        "panels": 2,
        "layout": "2x1",
        "categories": ["map", "trending"],
        "keywords": [],
        "region_focus": {"lat": 39.0, "lon": -98.0, "zoom": 4},
    },
    "cyber_intel": {
        "name": "Cyber Intelligence",
        "description": "Cybersecurity-focused dashboard",
        "panels": 4,
        "layout": "2x2",
        "categories": ["cyber", "cyber", "trending", "stats"],
        "keywords": ["hack", "breach", "ransomware", "malware", "cyberattack", "vulnerability", "exploit", "ddos", "phishing"],
        "region_focus": {"lat": 20.0, "lon": 0.0, "zoom": 2},
    },
    "breaking_news": {
        "name": "Breaking News Only",
        "description": "Critical and high severity feed",
        "panels": 2,
        "layout": "2x1",
        "categories": ["Breaking", "map"],
        "keywords": ["breaking", "just in", "urgent", "developing"],
        "region_focus": {"lat": 20.0, "lon": 0.0, "zoom": 2},
        "severity_filter": ["critical", "high"],
    },
    "military_watch": {
        "name": "Military Watch",
        "description": "Military movements and operations",
        "panels": 6,
        "layout": "3x2",
        "categories": ["Military", "aircraft", "map", "trending", "Military", "Military"],
        "keywords": ["military", "troops", "navy", "airforce", "army", "deployment", "exercise", "nato", "missile"],
        "region_focus": {"lat": 35.0, "lon": 35.0, "zoom": 3},
    },
    "full_map_view": {
        "name": "Full Map View",
        "description": "Large map with clickable story markers",
        "panels": 1,
        "layout": "1x1",
        "categories": ["map"],
        "keywords": [],
        "region_focus": {"lat": 20.0, "lon": 0.0, "zoom": 2},
    },
}


@app.get("/api/templates")
async def get_dashboard_templates():
    """Get available dashboard templates"""
    return [
        {
            "id": k,
            "name": v["name"],
            "description": v["description"],
            "panels": v["panels"],
            "layout": v["layout"],
            "categories": v["categories"],
        }
        for k, v in DASHBOARD_TEMPLATES.items()
    ]


@app.get("/api/templates/{template_id}")
async def get_dashboard_template(template_id: str):
    """Get a specific dashboard template"""
    if template_id not in DASHBOARD_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    return DASHBOARD_TEMPLATES[template_id]


@app.post("/api/dashboards/from-template")
async def create_dashboard_from_template(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Create a dashboard from a template"""
    template_id = data.get("template_id")
    if template_id not in DASHBOARD_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = DASHBOARD_TEMPLATES[template_id]
    name = data.get("name", template["name"])
    
    # Create dashboard
    dashboard = Dashboard(
        name=name,
        panels=template["panels"],
        layout=template["layout"],
        config={
            "categories": template["categories"],
            "keywords": template["keywords"],
            "region_focus": template["region_focus"],
            "from_template": template_id,
        }
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)
    return dashboard


# ========== WEBSOCKET ==========

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "subscribe":
                # Could implement channel subscriptions here
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# ========== SYSTEM ENDPOINTS ==========

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/fetch-now")
async def trigger_fetch():
    """Manually trigger fetch for all sources"""
    asyncio.create_task(fetch_all_sources())
    return {"status": "fetch triggered"}


@app.get("/api/source-types")
async def get_source_types():
    """Get available source types"""
    return {
        "types": list(COLLECTORS.keys()),
        "details": {
            "rss": {"name": "RSS/Atom Feed", "requires_url": True},
            "gdelt": {"name": "GDELT News", "requires_url": False},
            "reddit": {"name": "Reddit", "requires_url": False},
            "bluesky": {"name": "Bluesky", "requires_url": False},
            "telegram": {"name": "Telegram Channel", "requires_url": False},
            "adsb": {"name": "ADS-B Aircraft", "requires_url": False},
            "custom_rss": {"name": "Custom RSS with Keywords", "requires_url": True},
        },
    }


# ========== STATIC FILES (Development) ==========
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Serve frontend files in development
frontend_path = Path(__file__).parent.parent.parent / "frontend"
if frontend_path.exists():
    @app.get("/")
    async def serve_index():
        return FileResponse(frontend_path / "index.html")
    
    @app.get("/{path:path}")
    async def serve_static(path: str):
        file_path = frontend_path / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(frontend_path / "index.html")
