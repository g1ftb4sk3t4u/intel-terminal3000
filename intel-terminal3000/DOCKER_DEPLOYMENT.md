# Intel Terminal 3000 - Docker Deployment Guide

Quick start guide for deploying Intel Terminal 3000 on Linode or any Docker-compatible host.

## Prerequisites

- Linux server (Ubuntu 20.04+ or similar)
- Docker & Docker Compose installed
- At least 2GB RAM, 10GB storage
- Port 80 (HTTP) accessible

## Quick Start (Linode)

### 1. Create a Linode Instance
- **Image**: Ubuntu 22.04 LTS
- **Plan**: Nanode 1GB (minimum) or Linode 2GB (recommended)
- **Region**: Your preference
- **Add SSH key** for password-less access

### 2. SSH into your instance

```bash
ssh root@your.linode.ip.address
```

### 3. Install Docker & Docker Compose

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
usermod -aG docker root

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 4. Clone and Deploy

```bash
# Clone the repository
git clone https://github.com/yourusername/AI-tools.git
cd AI-tools/intel-terminal3000

# Build and launch containers
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f backend
```

### 5. Access your instance

- **Frontend (UI)**: `http://your.linode.ip.address:3000`
- **Backend API**: `http://your.linode.ip.address:8080`
- **API Docs**: `http://your.linode.ip.address:8080/docs`

## Environment Configuration

### .env File (Optional)

Create `.env` file in intel-terminal3000 directory for customization:

```bash
# disable/enable specific collectors
RSS_ENABLED=true
GDELT_ENABLED=true
REDDIT_ENABLED=true
BLUESKY_ENABLED=true
TRIAGE_METHOD=keyword
GEOCODE_ENABLED=true
```

Then update your `docker-compose.yml` to use env_file:
```yaml
env_file:
  - .env
```

## Data Persistence

- **Database**: Stored in `intel_db` Docker volume (automatic)
- **Data folder**: Mount `./data:/app/data` for custom storage
- **Backup**: `docker-compose exec backend sqlite3 /app/intel_terminal.db ".backup '/app/data/backup.db'"`

## Common Commands

### Start/Stop Services
```bash
docker-compose up -d      # Start in background
docker-compose down       # Stop all services
docker-compose restart    # Restart services
```

### View Logs
```bash
docker-compose logs -f backend    # Backend logs (live)
docker-compose logs -f frontend   # Frontend logs (live)
docker-compose logs --tail=50     # Last 50 lines
```

### Database Management
```bash
# Connect to database shell
docker-compose exec backend sqlite3 /app/intel_terminal.db

# Verify articles ingested
docker-compose exec backend sqlite3 /app/intel_terminal.db "SELECT COUNT(*) as total_articles FROM articles;"

# Clear old articles (keep last 1000)
docker-compose exec backend sqlite3 /app/intel_terminal.db "DELETE FROM articles WHERE id NOT IN (SELECT id FROM articles ORDER BY created_at DESC LIMIT 1000);"
```

### Troubleshooting

#### Health Check Failing
```bash
# Check if backend is actually running
docker-compose ps

# Test API manually
curl http://localhost:8080/api/articles?limit=1

# Increase health check timeout in docker-compose.yml
```

#### No Articles Appearing
```bash
# Verify sources are enabled
docker-compose exec backend sqlite3 /app/intel_terminal.db "SELECT name, enabled FROM sources LIMIT 10;"

# Force data fetch
curl -X POST http://localhost:8080/api/fetch-now

# Check for errors
docker-compose logs backend | grep -i error
```

#### Out of Memory
```bash
# Check memory usage
docker stats

# Reduce memory: Edit docker-compose.yml and add limits
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

## Production Optimization

### Use Nginx as Reverse Proxy (Optional)
If running with custom domain (e.g., intel.example.com), use letsencrypt with certbot:

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot certonly --standalone -d intel.example.com

# Update docker-compose for external access
# Edit frontend nginx.conf to add SSL configuration
```

### Enable Automated Backups
```bash
# Add to crontab for daily backups
crontab -e

# Add:
0 2 * * * docker-compose -f /root/AI-tools/intel-terminal3000/docker-compose.yml exec backend sqlite3 /app/intel_terminal.db ".backup '/app/data/backup-$(date +\%Y\%m\%d).db'"
```

### Monitor Service Health
```bash
# Check and restart failed containers
docker-compose ps | grep -v "Up" && docker-compose restart

# Add to crontab to check every 5 minutes
*/5 * * * * docker-compose -f /root/AI-tools/intel-terminal3000/docker-compose.yml ps | grep -qq "backend.*Up" || docker-compose -f /root/AI-tools/intel-terminal3000/docker-compose.yml restart backend
```

## Scaling Notes

- **Single Linode 2GB**: Handles ~5,000 articles/day comfortably
- **Multiple data sources**: May need Linode 4GB+ for 50+ feeds
- **High-traffic**: Consider Kubernetes on Linode Kubernetes Engine (LKE)

## Updates

```bash
cd intel-terminal3000
git pull
docker-compose down
docker-compose up -d --build
```

## Support

- Check logs: `docker-compose logs`
- API documentation: Navigate to `/docs endpoint
- Source configuration: See `backend/default_sources.json`
