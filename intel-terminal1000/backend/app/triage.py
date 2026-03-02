"""
Intel Terminal 1000 - AI Triage System
Database-backed keyword matching + optional AI backends
"""
import re
from typing import Dict, Any, Optional, List
from enum import Enum
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from .models import TriageKeyword
from .config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Default keywords (used to seed database on first run)
DEFAULT_KEYWORDS = [
    # Critical - Immediate threats
    {"keyword": "zero-day", "severity": "critical", "weight": 3, "description": "Zero-day vulnerability", "category": "cyber"},
    {"keyword": "0-day", "severity": "critical", "weight": 3, "description": "Zero-day vulnerability", "category": "cyber"},
    {"keyword": "0day", "severity": "critical", "weight": 3, "description": "Zero-day vulnerability", "category": "cyber"},
    {"keyword": "breach", "severity": "critical", "weight": 2, "description": "Security breach", "category": "cyber"},
    {"keyword": "ransomware", "severity": "critical", "weight": 3, "description": "Ransomware attack", "category": "cyber"},
    {"keyword": "APT", "severity": "critical", "weight": 3, "description": "Advanced Persistent Threat", "category": "cyber"},
    {"keyword": "nation-state", "severity": "critical", "weight": 3, "description": "Nation-state actor", "category": "cyber"},
    {"keyword": "active exploit", "severity": "critical", "weight": 3, "description": "Actively exploited", "category": "cyber"},
    {"keyword": "war", "severity": "critical", "weight": 2, "description": "Armed conflict", "category": "general"},
    {"keyword": "invasion", "severity": "critical", "weight": 3, "description": "Military invasion", "category": "general"},
    {"keyword": "nuclear", "severity": "critical", "weight": 2, "description": "Nuclear threat", "category": "general"},
    {"keyword": "terror", "severity": "critical", "weight": 2, "is_regex": True, "description": "Terrorism-related", "category": "general"},
    {"keyword": "mass casualty", "severity": "critical", "weight": 3, "description": "Mass casualty event", "category": "general"},
    {"keyword": "active shooter", "severity": "critical", "weight": 3, "description": "Active shooter", "category": "general"},
    {"keyword": "critical infrastructure", "severity": "critical", "weight": 2, "description": "Critical infrastructure", "category": "cyber"},
    {"keyword": "emergency", "severity": "critical", "weight": 1, "description": "Emergency situation", "category": "general"},

    # High - Significant events
    {"keyword": "attack", "severity": "high", "weight": 2, "description": "Attack (cyber/physical)", "category": "cyber"},
    {"keyword": "vulnerability", "severity": "high", "weight": 2, "description": "Security vulnerability", "category": "cyber"},
    {"keyword": "CVE-", "severity": "high", "weight": 2, "description": "CVE identifier", "category": "cyber"},
    {"keyword": "malware", "severity": "high", "weight": 2, "description": "Malware detection", "category": "cyber"},
    {"keyword": "backdoor", "severity": "high", "weight": 2, "description": "Backdoor access", "category": "cyber"},
    {"keyword": "hack", "severity": "high", "weight": 1, "is_regex": True, "description": "Hacking activity", "category": "cyber"},
    {"keyword": "phishing", "severity": "high", "weight": 2, "description": "Phishing campaign", "category": "cyber"},
    {"keyword": "DDoS", "severity": "high", "weight": 2, "description": "DDoS attack", "category": "cyber"},
    {"keyword": "conflict", "severity": "high", "weight": 1, "description": "Armed conflict", "category": "general"},
    {"keyword": "sanctions", "severity": "high", "weight": 1, "description": "Sanctions imposed", "category": "general"},
    {"keyword": "threat", "severity": "high", "weight": 1, "description": "Threat activity", "category": "cyber"},
    {"keyword": "escalat", "severity": "high", "weight": 2, "is_regex": True, "description": "Escalation", "category": "general"},
    {"keyword": "military", "severity": "high", "weight": 1, "description": "Military action", "category": "general"},
    {"keyword": "strike", "severity": "high", "weight": 1, "description": "Strike/attack", "category": "general"},
    {"keyword": "casualties", "severity": "high", "weight": 2, "description": "Casualties reported", "category": "general"},
    {"keyword": "compromised", "severity": "high", "weight": 2, "description": "System compromised", "category": "cyber"},
    {"keyword": "leaked", "severity": "high", "weight": 2, "description": "Data leaked", "category": "cyber"},
    {"keyword": "data breach", "severity": "high", "weight": 2, "description": "Data breach", "category": "cyber"},
    {"keyword": "espionage", "severity": "high", "weight": 2, "description": "Espionage activity", "category": "cyber"},
    {"keyword": "assassination", "severity": "high", "weight": 3, "description": "Assassination", "category": "general"},
    {"keyword": "coup", "severity": "high", "weight": 3, "description": "Coup attempt", "category": "general"},

    # Medium - Notable news
    {"keyword": "security", "severity": "medium", "weight": 1, "description": "Security-related", "category": "cyber"},
    {"keyword": "risk", "severity": "medium", "weight": 1, "description": "Risk assessment", "category": "cyber"},
    {"keyword": "warning", "severity": "medium", "weight": 1, "description": "Warning issued", "category": "cyber"},
    {"keyword": "advisory", "severity": "medium", "weight": 1, "description": "Security advisory", "category": "cyber"},
    {"keyword": "patch", "severity": "medium", "weight": 1, "description": "Patch released", "category": "tech"},
    {"keyword": "tension", "severity": "medium", "weight": 1, "description": "Rising tensions", "category": "general"},
    {"keyword": "protest", "severity": "medium", "weight": 1, "is_regex": True, "description": "Protests", "category": "general"},
    {"keyword": "diplomat", "severity": "medium", "weight": 1, "is_regex": True, "description": "Diplomatic activity", "category": "general"},
    {"keyword": "negotiat", "severity": "medium", "weight": 1, "is_regex": True, "description": "Negotiations", "category": "general"},
    {"keyword": "suspect", "severity": "medium", "weight": 1, "is_regex": True, "description": "Suspected activity", "category": "general"},
    {"keyword": "investigation", "severity": "medium", "weight": 1, "description": "Under investigation", "category": "general"},
    {"keyword": "alert", "severity": "medium", "weight": 1, "description": "Alert issued", "category": "cyber"},
    {"keyword": "incident", "severity": "medium", "weight": 1, "description": "Security incident", "category": "cyber"},
]


class TriageService:
    """Service for triaging articles by severity"""
    
    def __init__(self, session: Optional[AsyncSession] = None):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.method = settings.triage_method
        self.session = session
        self._keywords_cache: Optional[List[TriageKeyword]] = None
    
    async def get_keywords(self) -> List[TriageKeyword]:
        """Get keywords from database (with caching)"""
        if self._keywords_cache is not None:
            return self._keywords_cache
        
        if not self.session:
            return []
        
        result = await self.session.execute(
            select(TriageKeyword).where(TriageKeyword.enabled == True)
        )
        self._keywords_cache = list(result.scalars().all())
        return self._keywords_cache
    
    def invalidate_cache(self):
        """Clear the keyword cache"""
        self._keywords_cache = None
    
    async def triage(self, title: str, summary: str = "", category: str = None) -> Dict[str, Any]:
        """Triage an article and return severity + analysis."""
        text = f"{title} {summary}".lower()
        
        if self.method == "keyword":
            return await self._keyword_triage(text, category)
        elif self.method == "ollama":
            return await self._ollama_triage(text)
        elif self.method == "openai":
            return await self._openai_triage(text)
        elif self.method == "claude":
            return await self._claude_triage(text)
        else:
            return {"severity": Severity.LOW, "method": "manual"}
    
    async def _keyword_triage(self, text: str, category: str = None) -> Dict[str, Any]:
        """Database-backed keyword triage"""
        keywords = await self.get_keywords()
        
        # If no database keywords, use hardcoded fallback
        if not keywords:
            return self._fallback_keyword_triage(text)
        
        matched = []
        severity_scores = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 0,
            Severity.MEDIUM: 0,
            Severity.LOW: 0,
        }
        
        for kw in keywords:
            # Skip if category-specific and doesn't match
            if kw.category and category and kw.category.lower() != category.lower():
                continue
            
            # Check if keyword matches
            try:
                if kw.is_regex:
                    pattern = r'\b' + kw.keyword + r'\w*\b'
                    if re.search(pattern, text, re.IGNORECASE):
                        matched.append({"keyword": kw.keyword, "severity": kw.severity, "weight": kw.weight})
                        severity_scores[Severity(kw.severity)] += kw.weight
                else:
                    pattern = r'\b' + re.escape(kw.keyword.lower()) + r'\b'
                    if re.search(pattern, text, re.IGNORECASE):
                        matched.append({"keyword": kw.keyword, "severity": kw.severity, "weight": kw.weight})
                        severity_scores[Severity(kw.severity)] += kw.weight
            except Exception as e:
                logger.warning(f"Keyword match error for '{kw.keyword}': {e}")
        
        # Determine severity by highest weighted score
        if severity_scores[Severity.CRITICAL] >= 2:
            severity = Severity.CRITICAL
        elif severity_scores[Severity.CRITICAL] >= 1 or severity_scores[Severity.HIGH] >= 3:
            severity = Severity.HIGH if severity_scores[Severity.CRITICAL] == 0 else Severity.CRITICAL
        elif severity_scores[Severity.HIGH] >= 1:
            severity = Severity.HIGH
        elif severity_scores[Severity.MEDIUM] >= 1:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW
        
        return {
            "severity": severity,
            "method": "keyword_db",
            "matched": matched,
            "scores": {k.value: v for k, v in severity_scores.items()},
        }
    
    def _fallback_keyword_triage(self, text: str) -> Dict[str, Any]:
        """Fallback when no DB keywords available"""
        FALLBACK_PATTERNS = {
            Severity.CRITICAL: [
                r'\bzero[- ]?day\b', r'\b0[- ]?day\b', r'\bbreach\b', r'\bransomware\b',
                r'\bapt\b', r'\bnation[- ]?state\b', r'\bexploit\b', r'\bwar\b',
            ],
            Severity.HIGH: [
                r'\battack\b', r'\bvulnerability\b', r'\bcve-\d+', r'\bmalware\b',
                r'\bbackdoor\b', r'\bhack\w*\b', r'\bphishing\b', r'\bddos\b',
            ],
            Severity.MEDIUM: [
                r'\bsecurity\b', r'\brisk\b', r'\bwarning\b', r'\badvisory\b',
            ],
        }
        
        matched = []
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM]:
            for pattern in FALLBACK_PATTERNS[severity]:
                if re.search(pattern, text, re.IGNORECASE):
                    matched.append(pattern)
                    return {
                        "severity": severity,
                        "method": "keyword_fallback",
                        "matched": matched,
                    }
        
        return {"severity": Severity.LOW, "method": "keyword_fallback", "matched": []}
    
    async def _ollama_triage(self, text: str) -> Dict[str, Any]:
        """Triage using local Ollama LLM"""
        prompt = f"""Analyze this news headline/summary and classify its severity for a security/intelligence analyst.
        
Categories:
- critical: Active attacks, breaches, war, immediate threats
- high: Significant security events, conflicts, vulnerabilities
- medium: General security news, warnings, advisories
- low: Routine news, no immediate concern

Respond with ONLY the severity level (critical, high, medium, or low).

Text: {text[:1000]}

Severity:"""
        
        try:
            response = await self.http_client.post(
                f"{settings.ollama_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=15.0,
            )
            result = response.json()
            severity_text = result.get("response", "").strip().lower()
            
            if "critical" in severity_text:
                severity = Severity.CRITICAL
            elif "high" in severity_text:
                severity = Severity.HIGH
            elif "medium" in severity_text:
                severity = Severity.MEDIUM
            else:
                severity = Severity.LOW
            
            return {"severity": severity, "method": "ollama", "raw_response": severity_text}
            
        except Exception as e:
            logger.error(f"Ollama triage failed: {e}")
            return await self._keyword_triage(text, None)
    
    async def _openai_triage(self, text: str) -> Dict[str, Any]:
        """Triage using OpenAI API"""
        if not settings.openai_api_key:
            return await self._keyword_triage(text, None)
        
        try:
            response = await self.http_client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a security analyst. Classify news severity as: critical, high, medium, or low. Respond with only the severity level."},
                        {"role": "user", "content": f"Classify: {text[:1000]}"},
                    ],
                    "max_tokens": 10,
                },
            )
            result = response.json()
            severity_text = result["choices"][0]["message"]["content"].strip().lower()
            
            if "critical" in severity_text:
                severity = Severity.CRITICAL
            elif "high" in severity_text:
                severity = Severity.HIGH
            elif "medium" in severity_text:
                severity = Severity.MEDIUM
            else:
                severity = Severity.LOW
            
            return {"severity": severity, "method": "openai"}
            
        except Exception as e:
            logger.error(f"OpenAI triage failed: {e}")
            return await self._keyword_triage(text, None)
    
    async def _claude_triage(self, text: str) -> Dict[str, Any]:
        """Triage using Anthropic Claude API (supports Opus 4.6 and model selection)"""
        if not settings.anthropic_api_key:
            return await self._keyword_triage(text, None)

        # Allow model selection via config, default to Opus 4.6 if set
        model = getattr(settings, "claude_model", None) or "claude-3-opus-20240229"
        try:
            response = await self.http_client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 10,
                    "messages": [
                        {"role": "user", "content": f"As a security analyst, classify this news severity (respond with only: critical, high, medium, or low): {text[:1000]}"},
                    ],
                },
            )
            result = response.json()
            severity_text = result["content"][0]["text"].strip().lower()
            
            if "critical" in severity_text:
                severity = Severity.CRITICAL
            elif "high" in severity_text:
                severity = Severity.HIGH
            elif "medium" in severity_text:
                severity = Severity.MEDIUM
            else:
                severity = Severity.LOW
            
            return {"severity": severity, "method": "claude"}
            
        except Exception as e:
            logger.error(f"Claude triage failed: {e}")
            return await self._keyword_triage(text, None)
    
    async def close(self):
        await self.http_client.aclose()


async def seed_default_keywords(session: AsyncSession):
    """Seed the database with default triage keywords"""
    count = 0
    for kw_data in DEFAULT_KEYWORDS:
        existing = await session.execute(
            select(TriageKeyword).where(TriageKeyword.keyword == kw_data["keyword"])
        )
        if existing.scalar_one_or_none():
            continue
        
        keyword = TriageKeyword(
            keyword=kw_data["keyword"],
            severity=kw_data["severity"],
            weight=kw_data.get("weight", 1),
            is_regex=kw_data.get("is_regex", False),
            description=kw_data.get("description"),
        )
        session.add(keyword)
        count += 1
    
    await session.commit()
    if count > 0:
        logger.info(f"Seeded {count} default triage keywords")
    return count
