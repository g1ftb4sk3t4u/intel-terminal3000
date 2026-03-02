"""
Intel Terminal 1000 - Trending Detection System
Auto-detects regional spikes and topic surges
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from .models import Article, TrendingAlert
from .config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class TrendingDetector:
    """Detect trending topics and regional spikes"""
    
    # Thresholds for spike detection
    MIN_ARTICLES_FOR_SPIKE = 5  # Minimum articles to consider a spike
    SPIKE_PERCENTAGE_THRESHOLD = 100  # 100% increase = spike
    TIME_WINDOW_HOURS = 4  # Current window
    COMPARISON_WINDOW_HOURS = 24  # Compare against last 24h average
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def detect_regional_spikes(self) -> List[TrendingAlert]:
        """Detect regions with unusual article activity"""
        alerts = []
        
        now = datetime.utcnow()
        current_window_start = now - timedelta(hours=self.TIME_WINDOW_HOURS)
        comparison_window_start = now - timedelta(hours=self.COMPARISON_WINDOW_HOURS)
        
        # Get article counts by region for current window
        current_counts = await self.session.execute(
            select(Article.region, func.count(Article.id).label("count"))
            .where(and_(
                Article.created_at >= current_window_start,
                Article.region.isnot(None)
            ))
            .group_by(Article.region)
        )
        current_by_region = {row[0]: row[1] for row in current_counts.all()}
        
        # Get article counts for comparison window (average per TIME_WINDOW_HOURS)
        comparison_counts = await self.session.execute(
            select(Article.region, func.count(Article.id).label("count"))
            .where(and_(
                Article.created_at >= comparison_window_start,
                Article.created_at < current_window_start,
                Article.region.isnot(None)
            ))
            .group_by(Article.region)
        )
        
        # Calculate average per window
        windows_in_comparison = (self.COMPARISON_WINDOW_HOURS - self.TIME_WINDOW_HOURS) / self.TIME_WINDOW_HOURS
        comparison_avg = {
            row[0]: row[1] / max(windows_in_comparison, 1)
            for row in comparison_counts.all()
        }
        
        # Detect spikes
        for region, current_count in current_by_region.items():
            if current_count < self.MIN_ARTICLES_FOR_SPIKE:
                continue
            
            previous_avg = comparison_avg.get(region, 1)  # Default to 1 to avoid division by zero
            
            if previous_avg > 0:
                spike_pct = ((current_count - previous_avg) / previous_avg) * 100
            else:
                spike_pct = current_count * 100  # New region = high spike
            
            if spike_pct >= self.SPIKE_PERCENTAGE_THRESHOLD:
                # Check if we already have an active alert for this region
                existing = await self.session.execute(
                    select(TrendingAlert).where(and_(
                        TrendingAlert.region == region,
                        TrendingAlert.is_active == True,
                        TrendingAlert.created_at >= current_window_start
                    ))
                )
                if existing.scalar_one_or_none():
                    continue
                
                # Get sample articles
                sample_result = await self.session.execute(
                    select(Article.id, Article.title)
                    .where(and_(
                        Article.region == region,
                        Article.created_at >= current_window_start
                    ))
                    .limit(5)
                )
                samples = sample_result.all()
                
                # Determine severity based on spike magnitude
                if spike_pct >= 500 or current_count >= 20:
                    severity = "critical"
                elif spike_pct >= 200 or current_count >= 10:
                    severity = "high"
                else:
                    severity = "medium"
                
                # Create alert
                alert = TrendingAlert(
                    alert_type="region_spike",
                    region=region,
                    article_count=current_count,
                    previous_count=int(previous_avg),
                    spike_percentage=spike_pct,
                    sample_articles=[{"id": s[0], "title": s[1][:100]} for s in samples],
                    severity=severity,
                    expires_at=now + timedelta(hours=6),
                )
                self.session.add(alert)
                alerts.append(alert)
                
                logger.warning(
                    f"🚨 SPIKE DETECTED: {region} - {current_count} articles "
                    f"({spike_pct:.0f}% increase) - {severity.upper()}"
                )
        
        if alerts:
            await self.session.commit()
        
        return alerts
    
    async def detect_keyword_surges(self, keywords: List[str] = None) -> List[TrendingAlert]:
        """Detect unusual increases in specific keywords"""
        alerts = []
        
        # Default high-priority keywords to watch
        if keywords is None:
            keywords = [
                "attack", "invasion", "strike", "bombing", "explosion",
                "nuclear", "missile", "troops", "deployed", "mobilize",
                "coup", "assassination", "emergency", "martial law",
            ]
        
        now = datetime.utcnow()
        current_window_start = now - timedelta(hours=2)  # Shorter window for keywords
        comparison_start = now - timedelta(hours=12)
        
        for keyword in keywords:
            # Count current
            current_result = await self.session.execute(
                select(func.count(Article.id))
                .where(and_(
                    Article.created_at >= current_window_start,
                    Article.title.ilike(f"%{keyword}%")
                ))
            )
            current_count = current_result.scalar() or 0
            
            if current_count < 3:  # Need at least 3 mentions
                continue
            
            # Count comparison period
            comparison_result = await self.session.execute(
                select(func.count(Article.id))
                .where(and_(
                    Article.created_at >= comparison_start,
                    Article.created_at < current_window_start,
                    Article.title.ilike(f"%{keyword}%")
                ))
            )
            comparison_count = comparison_result.scalar() or 0
            
            # Normalize to same window size
            comparison_avg = comparison_count / 5  # 10h / 2h = 5 windows
            
            if comparison_avg > 0:
                spike_pct = ((current_count - comparison_avg) / comparison_avg) * 100
            else:
                spike_pct = current_count * 100
            
            if spike_pct >= 150:  # 150% increase for keywords
                # Check for existing alert
                existing = await self.session.execute(
                    select(TrendingAlert).where(and_(
                        TrendingAlert.keyword == keyword,
                        TrendingAlert.is_active == True,
                        TrendingAlert.created_at >= current_window_start
                    ))
                )
                if existing.scalar_one_or_none():
                    continue
                
                alert = TrendingAlert(
                    alert_type="keyword_surge",
                    keyword=keyword,
                    article_count=current_count,
                    previous_count=int(comparison_avg),
                    spike_percentage=spike_pct,
                    severity="high" if spike_pct >= 300 else "medium",
                    expires_at=now + timedelta(hours=4),
                )
                self.session.add(alert)
                alerts.append(alert)
                
                logger.warning(f"📈 KEYWORD SURGE: '{keyword}' - {current_count} mentions ({spike_pct:.0f}% increase)")
        
        if alerts:
            await self.session.commit()
        
        return alerts
    
    async def detect_new_conflict_zones(self) -> List[TrendingAlert]:
        """Detect new areas with conflict-related keywords"""
        alerts = []
        
        conflict_keywords = [
            "attack", "strike", "troops", "military", "soldiers", "combat",
            "killed", "casualties", "war", "conflict", "battle",
        ]
        
        now = datetime.utcnow()
        recent_window = now - timedelta(hours=6)
        
        # Find countries with multiple conflict-related articles that didn't have them before
        for keyword in conflict_keywords:
            result = await self.session.execute(
                select(Article.country, func.count(Article.id).label("count"))
                .where(and_(
                    Article.created_at >= recent_window,
                    Article.country.isnot(None),
                    Article.title.ilike(f"%{keyword}%")
                ))
                .group_by(Article.country)
                .having(func.count(Article.id) >= 3)
            )
            
            for country, count in result.all():
                # Check if this is a new conflict zone (no similar articles in past week)
                historical = await self.session.execute(
                    select(func.count(Article.id))
                    .where(and_(
                        Article.created_at >= now - timedelta(days=7),
                        Article.created_at < recent_window,
                        Article.country == country,
                        Article.title.ilike(f"%{keyword}%")
                    ))
                )
                historical_count = historical.scalar() or 0
                
                if historical_count < 2 and count >= 3:  # New conflict zone
                    existing = await self.session.execute(
                        select(TrendingAlert).where(and_(
                            TrendingAlert.country == country,
                            TrendingAlert.alert_type == "new_conflict",
                            TrendingAlert.is_active == True,
                        ))
                    )
                    if existing.scalar_one_or_none():
                        continue
                    
                    alert = TrendingAlert(
                        alert_type="new_conflict",
                        country=country,
                        keyword=keyword,
                        article_count=count,
                        severity="critical",
                        expires_at=now + timedelta(hours=12),
                    )
                    self.session.add(alert)
                    alerts.append(alert)
                    
                    logger.warning(f"⚔️ NEW CONFLICT ZONE: {country} - {count} articles with '{keyword}'")
        
        if alerts:
            await self.session.commit()
        
        return alerts
    
    async def get_active_alerts(self) -> List[TrendingAlert]:
        """Get all active trending alerts"""
        now = datetime.utcnow()
        
        result = await self.session.execute(
            select(TrendingAlert)
            .where(and_(
                TrendingAlert.is_active == True,
                TrendingAlert.is_acknowledged == False,
                TrendingAlert.expires_at > now
            ))
            .order_by(TrendingAlert.severity, TrendingAlert.created_at.desc())
        )
        return result.scalars().all()
    
    async def acknowledge_alert(self, alert_id: int):
        """Mark an alert as acknowledged"""
        result = await self.session.execute(
            select(TrendingAlert).where(TrendingAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_acknowledged = True
            await self.session.commit()
    
    async def run_all_detections(self) -> List[TrendingAlert]:
        """Run all detection methods"""
        all_alerts = []
        
        try:
            regional = await self.detect_regional_spikes()
            all_alerts.extend(regional)
        except Exception as e:
            logger.error(f"Regional spike detection failed: {e}")
        
        try:
            keywords = await self.detect_keyword_surges()
            all_alerts.extend(keywords)
        except Exception as e:
            logger.error(f"Keyword surge detection failed: {e}")
        
        try:
            conflicts = await self.detect_new_conflict_zones()
            all_alerts.extend(conflicts)
        except Exception as e:
            logger.error(f"New conflict detection failed: {e}")
        
        return all_alerts
