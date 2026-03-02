"""
Intel Terminal 1000 - Database Seeder
Seeds the database with default sources from default_sources.json
"""
import asyncio
import json
from pathlib import Path
from sqlalchemy import select
from app.database import init_db, AsyncSessionLocal
from app.models import Source, Dashboard


async def seed_sources():
    """Load default sources into database"""
    sources_file = Path(__file__).parent.parent / "default_sources.json"
    
    if not sources_file.exists():
        print("No default_sources.json found, skipping seed")
        return
    
    with open(sources_file) as f:
        default_sources = json.load(f)
    
    async with AsyncSessionLocal() as session:
        for source_data in default_sources:
            # Check if already exists
            existing = await session.execute(
                select(Source).where(Source.name == source_data["name"])
            )
            if existing.scalar_one_or_none():
                continue
            
            source = Source(
                name=source_data["name"],
                url=source_data.get("url"),
                source_type=source_data["source_type"],
                category=source_data.get("category"),
                config=source_data.get("config"),
                enabled=True,
            )
            session.add(source)
            print(f"Added source: {source_data['name']}")
        
        await session.commit()


async def seed_default_dashboard():
    """Create a default dashboard if none exists"""
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(Dashboard))
        if existing.scalars().first():
            return
        
        dashboard = Dashboard(
            name="Command Center",
            description="Default 4-panel intelligence dashboard",
            layout="2x2",
            is_default=True,
            panels=[
                {
                    "id": "panel-1",
                    "module": "feed",
                    "title": "All Intel",
                    "filters": {}
                },
                {
                    "id": "panel-2",
                    "module": "map",
                    "title": "Global Heat Map",
                    "filters": {}
                },
                {
                    "id": "panel-3",
                    "module": "feed",
                    "title": "Critical Alerts",
                    "filters": {"severity": "critical"}
                },
                {
                    "id": "panel-4",
                    "module": "stats",
                    "title": "Statistics",
                    "filters": {}
                }
            ]
        )
        session.add(dashboard)
        await session.commit()
        print("Created default dashboard: Command Center")


async def seed_keywords():
    """Seed default triage keywords"""
    from app.triage import seed_default_keywords
    async with AsyncSessionLocal() as session:
        count = await seed_default_keywords(session)
        if count > 0:
            print(f"Seeded {count} default triage keywords")


async def main():
    print("Initializing database...")
    await init_db()
    
    print("Seeding sources...")
    await seed_sources()
    
    print("Seeding default dashboard...")
    await seed_default_dashboard()
    
    print("Seeding triage keywords...")
    await seed_keywords()
    
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
