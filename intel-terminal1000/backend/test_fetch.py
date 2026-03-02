"""Quick test script for collectors"""
import asyncio
import httpx

async def test_bbc():
    """Test fetching BBC RSS feed directly"""
    async with httpx.AsyncClient(
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        follow_redirects=True,
    ) as client:
        print("Fetching BBC RSS...")
        resp = await client.get("http://feeds.bbci.co.uk/news/world/rss.xml")
        print(f"Status: {resp.status_code}")
        print(f"Response length: {len(resp.text)}")
        print(f"First 500 chars: {resp.text[:500]}")
        
        import feedparser
        feed = feedparser.parse(resp.text)
        print(f"\nFeed entries: {len(feed.entries)}")
        
        if feed.entries:
            print("\nFirst 3 articles:")
            for entry in feed.entries[:3]:
                print(f"  - {entry.get('title', 'No title')}")

async def test_reddit():
    """Test Reddit JSON API"""
    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": "IntelTerminal/2.0"},
        follow_redirects=True,
    ) as client:
        print("\nFetching Reddit r/worldnews...")
        resp = await client.get("https://www.reddit.com/r/worldnews/hot.json?limit=5")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            posts = data.get("data", {}).get("children", [])
            print(f"Posts found: {len(posts)}")
            
            for post in posts[:3]:
                title = post.get("data", {}).get("title", "No title")
                print(f"  - {title[:80]}...")

if __name__ == "__main__":
    asyncio.run(test_bbc())
    asyncio.run(test_reddit())
