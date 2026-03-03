# MikroTik Headless Scraper - Docker Edition

Self-contained Docker image for running the MikroTik firmware scraper without dependency issues.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and run full scan
docker-compose up --build

# Run as background daemon
docker-compose up -d --build

# Check logs
docker-compose logs -f mikrotik-scraper

# Stop
docker-compose down
```

### Using Docker Directly

```bash
# Build image
docker build -t mikrotik-scraper .

# Run full scan (saves to ./mikrotik_archive)
docker run --rm -v $(pwd)/mikrotik_archive:/app/mikrotik_archive mikrotik-scraper --full-scan

# Run specific version
docker run --rm -v $(pwd)/mikrotik_archive:/app/mikrotik_archive mikrotik-scraper --scan-version 6.51

# Run daemon (background)
docker run -d --name mikrotik-daemon \
  -v $(pwd)/mikrotik_archive:/app/mikrotik_archive \
  mikrotik-scraper --daemon start

# Check daemon status
docker exec mikrotik-daemon python3 mikrotik_headless.py --daemon status

# Stop daemon
docker stop mikrotik-daemon
docker rm mikrotik-daemon
```

## Available Commands

```bash
# Full scan all versions 3.30 → current
--full-scan

# Scan specific version
--scan-version 6.51

# Run as persistent daemon (checks for new versions every 15 min)
--daemon start|stop|status

# Display statistics
--stats

# List all found versions
--list-versions

# Check for new versions via RSS
--check-rss

# Customize workers/retries
--workers 8 --retries 3

# Enable night mode (slow, 2 workers, less network load)
--night-mode
```

## Output

All downloaded files and logs are stored in `./mikrotik_archive/`:
- Organized by version and architecture
- `headless.log` - Full execution log
- `download_stats.json` - Download statistics
- `found_versions.json` - List of discovered versions

## Requirements

- Docker or Docker Desktop installed
- Internet access (for downloading MikroTik firmware)
- ~500GB+ free disk space (for all versions)

## Running on Linux Server

```bash
# SSH into server
ssh user@server

# Clone repo or upload files
cd /opt/AI-tools/mikrotik

# Run container
docker-compose up --build

# Or run in background
docker-compose up -d --build
docker-compose logs -f
```

## Notes

- The container uses Python 3.11 – no dependency conflicts
- Volume mount syncs `/app/mikrotik_archive` to local `./mikrotik_archive/`
- Full scan typically takes several hours depending on bandwidth
- Can be interrupted and resumed (skips existing files)
- Network usage is ~100-200KB per check, much lower during night-mode
