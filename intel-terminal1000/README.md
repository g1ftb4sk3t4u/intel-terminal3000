# Intel Terminal 1000

**Multi-Dashboard Intelligence Aggregation Platform**

Version 2.0 - Advanced intelligence monitoring with configurable dashboards, real-time data from multiple sources, AI-powered triage, and geographic heat mapping.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-teal.svg)

---

## Features

### Multi-Dashboard System
- **Up to 4 panels** per dashboard in customizable layouts (1x1, 2x1, 2x2, 3x1)
- **Module types**: Feed, Heat Map, Statistics, Timeline Chart, Alerts, Starred
- **Per-panel filtering** by category, severity, source type, region
- **Multiple dashboards** - create focused views for different use cases

### Multi-Source Intelligence
| Source | Description | Real-time | Setup Required |
|--------|-------------|-----------|----------------|
| **RSS** | Traditional RSS/Atom feeds | ~5 min | Feed URL |
| **GDELT** | Global news database (190+ countries) | 15 min | None |
| **Reddit** | Subreddit monitoring | Near-RT | None (public) |
| **Bluesky** | Decentralized social network | Real-time | None (public) |
| **Telegram** | Public channel monitoring | Near-RT | Optional API |

### Geographic Heat Map
- **Automatic location extraction** from article content
- **Regional aggregation** for heat map visualization
- **Known locations database** for instant geocoding (no API calls)
- **Nominatim integration** for unknown locations (free)

### AI Triage System
- **Keyword Scoring** (Built-in, instant, no setup)
- **Ollama** (Local LLM, free, private)
- **OpenAI API** (GPT-3.5/4)
- **Claude API** (Anthropic)
- **Manual** (Click-to-set severity)

### Real-time Features
- **WebSocket updates** - instant article notifications
- **Sound alerts** for critical/high severity items
- **Live connection status** indicator

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/intel-terminal1000.git
cd intel-terminal1000

# Start the services
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

### Option 2: Local Development

```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
python run.py

# Frontend (separate terminal)
cd frontend
# Serve with any static server, e.g.:
python -m http.server 3000
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Data Sources (toggle on/off)
RSS_ENABLED=true
GDELT_ENABLED=true
REDDIT_ENABLED=false
BLUESKY_ENABLED=false
TELEGRAM_ENABLED=false

# Fetch Intervals (seconds)
RSS_FETCH_INTERVAL=300
GDELT_FETCH_INTERVAL=900

# AI Triage Method
# Options: keyword | ollama | openai | claude | manual
TRIAGE_METHOD=keyword

# For Ollama (local LLM)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# For OpenAI (optional)
OPENAI_API_KEY=sk-...

# For Claude (optional)
ANTHROPIC_API_KEY=sk-ant-...
```

### Adding Data Sources

1. Click the **Settings** gear icon
2. Click **+ Add Source**
3. Select source type and configure:
   - **RSS**: Enter feed URL
   - **GDELT**: Enter search query (e.g., "cybersecurity OR conflict")
   - **Reddit**: Enter subreddit name (e.g., "worldnews")
   - **Telegram**: Enter public channel name

---

## Dashboard Configuration

### Creating a Dashboard

1. Click **+ New Dashboard**
2. Enter a name
3. Select layout (1, 2, 3, or 4 panels)
4. Configure each panel:
   - Choose module type
   - Set optional filters (category, severity)
   - Add custom title

### Module Types

| Module | Description |
|--------|-------------|
| **Feed** | Scrolling list of articles with filters |
| **Heat Map** | Geographic visualization of events |
| **Statistics** | Real-time counts and breakdowns |
| **Timeline** | Chart of article volume over time |
| **Alerts** | Critical severity items only |
| **Starred** | Your starred/saved articles |

### Panel Filters

Each feed panel can filter by:
- **Category**: cyber, geopolitical, military, economic, tech
- **Severity**: critical, high, medium, low
- **Source Type**: rss, gdelt, reddit, bluesky, telegram
- **Region**: North America, Europe, Asia, Middle East, etc.

---

## API Reference

### Articles

```
GET  /api/articles              # List articles (with filters)
GET  /api/articles/{id}          # Get single article
PATCH /api/articles/{id}         # Update article (severity, starred, etc.)
```

Query parameters for `/api/articles`:
- `category`: Filter by category
- `severity`: Filter by severity
- `source_type`: Filter by source
- `search`: Text search
- `region`: Filter by region
- `starred`: Filter starred (true/false)
- `limit`: Max results (default 50)
- `offset`: Pagination offset

### Sources

```
GET  /api/sources                # List all sources
POST /api/sources                # Create source
DELETE /api/sources/{id}          # Delete source
POST /api/sources/{id}/fetch     # Trigger manual fetch
```

### Dashboards

```
GET  /api/dashboards             # List dashboards
POST /api/dashboards             # Create dashboard
PUT  /api/dashboards/{id}         # Update dashboard
DELETE /api/dashboards/{id}       # Delete dashboard
```

### Maps & Stats

```
GET /api/map/heatmap             # Heat map data points
GET /api/map/regions             # Article counts by region
GET /api/stats                   # Overall statistics
GET /api/stats/timeline          # Timeline data for charts
```

### System

```
GET  /api/health                 # Health check
POST /api/fetch-now              # Trigger fetch for all sources
GET  /api/source-types           # Available source types
```

### WebSocket

```
WS /ws                           # Real-time updates
```

Messages:
- `{type: "new_article", article: {...}}` - New article received
- `{type: "ping"}` / `{type: "pong"}` - Heartbeat

---

## Deployment

### Railway

```bash
# Install Railway CLI
npm install -g railway

# Login and deploy
railway login
railway init
railway up
```

### Render

1. Connect your GitHub repository
2. Create a new Web Service
3. Use Dockerfile: `Dockerfile.railway`
4. Set environment variables in Render dashboard

### Manual VPS

```bash
# Build and run
docker build -f Dockerfile.railway -t intel-terminal1000 .
docker run -d -p 80:80 -p 8000:8000 intel-terminal1000
```

---

## Data Source Details

### GDELT (Recommended)

The Global Database of Events, Language, and Tone is **free** and provides:
- 190+ countries coverage
- Updates every 15 minutes
- Pre-extracted geolocation
- Massive historical archive

No API key required.

### Reddit

Public subreddits can be monitored without authentication:
- r/worldnews
- r/geopolitics
- r/cybersecurity
- r/netsec

### Bluesky

Bluesky's AT Protocol allows public feed access:
- No authentication for public feeds
- Growing alternative to Twitter
- Open source ecosystem

### Telegram

For public channels, limited scraping is possible without API credentials. For full access:

1. Go to https://my.telegram.org
2. Create an application
3. Add API ID and Hash to `.env`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  Feed   │ │   Map   │ │  Stats  │ │  Chart  │          │
│  │  Panel  │ │  Panel  │ │  Panel  │ │  Panel  │          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       └───────────┴───────────┴───────────┘                 │
│                        │ WebSocket + REST                    │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   API Router                          │  │
│  └──────────────────────────────────────────────────────┘  │
│            │              │              │                   │
│  ┌─────────┴────┐ ┌──────┴─────┐ ┌─────┴──────┐           │
│  │  Collectors  │ │   Triage   │ │    Geo     │           │
│  │  RSS/GDELT/  │ │  Keyword/  │ │  Location  │           │
│  │  Reddit/etc  │ │  AI/Manual │ │  Extraction │           │
│  └──────────────┘ └────────────┘ └────────────┘           │
│                         │                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               SQLite Database                         │  │
│  │  Articles | Sources | Dashboards | GeoCache          │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Roadmap

- [ ] Twitter/X integration (via Nitter or official API)
- [ ] Discord webhook notifications
- [ ] Email digest reports
- [ ] Advanced alert rules (compound conditions)
- [ ] Sentiment analysis
- [ ] Entity extraction (people, organizations)
- [ ] Export to CSV/JSON
- [ ] Mobile-responsive improvements
- [ ] User authentication
- [ ] Multi-user support

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

Built with:
- [FastAPI](https://fastapi.tiangolo.com/)
- [Leaflet.js](https://leafletjs.com/)
- [Chart.js](https://www.chartjs.org/)
- [GDELT Project](https://www.gdeltproject.org/)

---

*Intel Terminal 1000 - See Everything. Miss Nothing.*
