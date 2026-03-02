# Intel Terminal 3000 - Linode Docker Deployment (Quick Start)

Deploy Intel Terminal 3000 on Linode in **15 minutes**.

---

## 1. Create Linode Instance

1. Go to [Linode.com](https://cloud.linode.com/)
2. Click **Create → Linode**
3. **Image:** Ubuntu 22.04 LTS
4. **Plan:** Linode 4GB (minimum) or 8GB (recommended)
5. **Region:** Pick closest to you
6. **Password:** Set root password
7. Click **Create**

---

## 2. SSH Into Linode

```bash
ssh root@YOUR_IP_ADDRESS
```

( Get IP from Linode dashboard )

---

## 3. Install Docker

Copy & paste this entire block:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker --version && docker-compose --version
```

---

## 4. Clone & Run

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/AI-tools.git
cd AI-tools/intel-terminal3000
docker-compose up -d
```

---

## 5. Verify

```bash
# Check status
docker-compose ps

# Test API
curl http://localhost:8080/api/stats

# Open in browser
# http://YOUR_IP_ADDRESS:3000
```

---

## 6. (Optional) Domain + HTTPS

### Configure Domain DNS
Point your domain A records to `YOUR_IP_ADDRESS` (wait 5-15 min for DNS)

### Install Nginx + SSL

```bash
apt install nginx certbot python3-certbot-nginx -y

# Create config
cat > /etc/nginx/sites-available/intel <<'EOF'
upstream be { server localhost:8080; }
upstream fe { server localhost:3000; }

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / { proxy_pass http://fe; proxy_set_header Host $host; }
    location /api/ { proxy_pass http://be; proxy_set_header Host $host; }
}
EOF

ln -s /etc/nginx/sites-available/intel /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl start nginx && systemctl enable nginx

# Get certificate
certbot --nginx -d your-domain.com
```

Then access at `https://your-domain.com`

---

## 7. Manage Services

```bash
# View logs
docker-compose logs -f backend

# Restart
docker-compose restart

# Update code
cd /opt/AI-tools/intel-terminal3000
git pull origin main
docker-compose build
docker-compose up -d

# Stop
docker-compose down
```

---

## 8. Backup Database

```bash
# Manual backup
cp /opt/AI-tools/intel-terminal3000/intel_terminal.db ~/backup_$(date +%Y%m%d).db

# Auto-backup daily
cat > /etc/cron.daily/intel-bak <<'EOF'
#!/bin/bash
cp /opt/AI-tools/intel-terminal3000/intel_terminal.db /root/backups/intel_$(date +%Y%m%d).db
find /root/backups -name "intel_*.db" -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/intel-bak
mkdir -p /root/backups
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8080/3000 in use | `fuser -k 8080/tcp` |
| Container won't start | `docker-compose logs backend` |
| No data showing | Wait 5min for collectors to run, check logs |
| Database full | `rm intel_terminal.db` to reset |
| Out of memory | Upgrade Linode size or enable swap |

---

## Done! 🎉

- **Frontend:** `http://YOUR_IP:3000` (or your domain)
- **API:** `http://YOUR_IP:8080/api`
- **Logs:** `docker-compose logs -f`

Everything auto-starts after reboot. Enjoy!

---

**Need help?** Check main `DOCKER_DEPLOYMENT.md` for detailed instructions.
