# Ontology Hub Deployment Guide

This guide covers deploying Ontology Hub to a VPS with:
- **Backend**: Docker container (FastAPI + PostgreSQL)
- **Frontend**: Static files served by Caddy
- **Reverse Proxy**: Caddy (running in Docker)

## Prerequisites

- Debian/Ubuntu VPS with Docker installed
- Caddy running as a Docker container with an external `web` network
- GitHub CLI (`gh`) installed and authenticated
- Domain with A record pointing to your VPS

### Install GitHub CLI (if needed)

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh
gh auth login
```

---

## Deployment Steps

### 1. Create Directory Structure

```bash
sudo mkdir -p /srv/ontology-hub/frontend/dist
sudo chown -R $USER:$USER /srv/ontology-hub
```

### 2. Copy Docker Compose File

```bash
cd /srv/ontology-hub
curl -o docker-compose.prod.yml https://raw.githubusercontent.com/labki-org/ontology-hub/main/deploy/docker-compose.prod.yml
```

Edit to match your network name and add a network alias for Caddy:

```bash
nano docker-compose.prod.yml
```

Update the networks section and backend service:
```yaml
  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}-backend:latest
    # ... other config ...
    networks:
      internal:
      web:
        aliases:
          - ontology-hub-backend  # Alias for Caddy to use

networks:
  internal:
  web:
    external: true
```

### 3. Create Environment File

```bash
nano /srv/ontology-hub/.env
```

**Important:** No leading spaces, no spaces around `=`, and no trailing instructions.

```bash
# GitHub repository for Docker image
GITHUB_REPOSITORY=labki-org/ontology-hub

# Database
POSTGRES_PASSWORD=<generate with: openssl rand -hex 32>

# CORS (your frontend domain)
CORS_ORIGINS=https://ontology.labki.org

# GitHub API (for ontology repo sync)
GITHUB_TOKEN=<your GitHub PAT with repo access>
GITHUB_REPO_OWNER=labki-org
GITHUB_REPO_NAME=labki-ontology
GITHUB_WEBHOOK_SECRET=<your webhook secret>

# GitHub OAuth (create at https://github.com/settings/developers)
GITHUB_CLIENT_ID=<your OAuth app client ID>
GITHUB_CLIENT_SECRET=<your OAuth app client secret>

# Session security
SESSION_SECRET=<generate with: openssl rand -hex 32>

# Frontend URL (for OAuth redirects)
FRONTEND_URL=https://ontology.labki.org
```

Generate secrets:
```bash
openssl rand -hex 32  # Run twice for POSTGRES_PASSWORD and SESSION_SECRET
```

### 4. Configure Caddy

#### Add volume mount for frontend

Edit your Caddy docker-compose.yml:

```yaml
services:
  caddy:
    # ... existing config ...
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - /srv/ontology-hub/frontend/dist:/srv/ontology-hub/frontend/dist:ro  # ADD THIS
```

#### Add site to Caddyfile

Append to your Caddyfile (use the network alias you configured):

```caddyfile
ontology.labki.org {
    root * /srv/ontology-hub/frontend/dist
    encode gzip zstd

    handle /api/* {
        reverse_proxy ontology-hub-backend:8000
    }
    handle /health {
        reverse_proxy ontology-hub-backend:8000
    }
    handle /admin/* {
        reverse_proxy ontology-hub-backend:8000
    }

    handle {
        try_files {path} /index.html
        file_server
    }

    @immutable path *.js *.css *.woff2
    header @immutable Cache-Control "public, max-age=31536000, immutable"

    @html path *.html /
    header @html Cache-Control "no-cache"
}
```

#### Restart Caddy

```bash
cd /path/to/caddy
docker compose down
docker compose up -d
```

### 5. Start Database and Run Migrations

The database must be initialized with Alembic migrations before starting the backend.

```bash
cd /srv/ontology-hub

# Start only the database first
docker compose -f docker-compose.prod.yml up -d db

# Wait for database to be healthy (check status)
docker compose -f docker-compose.prod.yml ps

# Run database migrations (creates tables and materialized views)
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
```

### 6. Start Backend

```bash
docker compose -f docker-compose.prod.yml up -d backend
```

### 7. Deploy Frontend

```bash
# Check that CI has completed
gh run list --repo labki-org/ontology-hub --limit 1

# Download frontend build artifacts
gh run download --repo labki-org/ontology-hub --name frontend-dist --dir /tmp/frontend-dist
cp -r /tmp/frontend-dist/* /srv/ontology-hub/frontend/dist/
rm -rf /tmp/frontend-dist
```

### 8. Initialize Ontology Data

Sync the ontology from GitHub:

```bash
curl -X POST https://ontology.labki.org/admin/sync-v2
```

Expected response:
```json
{"commit_sha":"...","status":"completed","entity_counts":{...},"warnings":null,"duration":...}
```

---

## Verification

```bash
# Health check
curl https://ontology.labki.org/health
# Expected: {"status":"healthy","database":"connected"}

# API test
curl https://ontology.labki.org/api/v2/entities | head

# Check backend logs
docker compose -f docker-compose.prod.yml logs -f backend

# Verify frontend files are served by Caddy
docker exec caddy ls -la /srv/ontology-hub/frontend/dist/
```

Visit https://ontology.labki.org in your browser.

---

## Manual Updates

### Update Backend

```bash
cd /srv/ontology-hub
docker compose -f docker-compose.prod.yml pull backend
docker compose -f docker-compose.prod.yml up -d backend
```

### Update Frontend

```bash
# Wait for CI to complete
gh run list --repo labki-org/ontology-hub --limit 1

# Download and deploy
gh run download --repo labki-org/ontology-hub --name frontend-dist --dir /tmp/frontend-dist
rm -rf /srv/ontology-hub/frontend/dist/*
cp -r /tmp/frontend-dist/* /srv/ontology-hub/frontend/dist/
rm -rf /tmp/frontend-dist
```

### Run New Migrations

After backend updates that include database changes:

```bash
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml restart backend
```

---

## Clean Slate (Reset Everything)

If you need to start fresh:

```bash
cd /srv/ontology-hub

# Stop all services
docker compose -f docker-compose.prod.yml down

# Remove database volume (WARNING: deletes all data)
docker volume rm ontology-hub_pgdata

# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Start database
docker compose -f docker-compose.prod.yml up -d db

# Wait for healthy status
docker compose -f docker-compose.prod.yml ps

# Run migrations
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Start backend
docker compose -f docker-compose.prod.yml up -d backend

# Re-sync ontology data
curl -X POST https://ontology.labki.org/admin/sync-v2
```

---

## Troubleshooting

### .env file errors

```
failed to read .env: line X: key cannot contain a space
```

Check your `.env` file:
- No leading spaces on any line
- No spaces around `=` (use `KEY=value` not `KEY = value`)
- Comments must start with `#`
- Remove any instructional text that isn't commented out

### Backend won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check database connection
docker compose -f docker-compose.prod.yml logs db
```

### Migration fails with "table already exists"

If tables were created before migrations ran:

```bash
# Mark migration as applied without running it
docker compose -f docker-compose.prod.yml run --rm backend alembic stamp head
```

### Caddy can't reach backend

Ensure both containers are on the same network:

```bash
docker network inspect web
```

Both `caddy` and `ontology-hub-backend-1` (or your backend container) should be listed.

If you added a network alias, restart the backend for it to take effect:
```bash
docker compose -f docker-compose.prod.yml up -d backend
```

### Frontend shows blank page

Check browser console (F12) for errors.

**"Dynamic require" errors:** This is a build issue. Ensure you're using the latest frontend build:
```bash
gh run download --repo labki-org/ontology-hub --name frontend-dist --dir /tmp/frontend-dist
rm -rf /srv/ontology-hub/frontend/dist/*
cp -r /tmp/frontend-dist/* /srv/ontology-hub/frontend/dist/
rm -rf /tmp/frontend-dist
```

**404 errors:** Check that Caddy can see the frontend files:
```bash
docker exec caddy ls -la /srv/ontology-hub/frontend/dist/
```

If "No such file or directory", the volume mount isn't configured. Restart Caddy after adding the volume.

### OAuth redirect fails

Verify:
- `FRONTEND_URL` in `.env` matches your domain exactly (including https://)
- GitHub OAuth app callback URL is set to `https://ontology.labki.org/api/v1/auth/callback`

---

## Directory Structure

```
/srv/ontology-hub/
├── docker-compose.prod.yml
├── .env                    # Production secrets (not in git)
└── frontend/
    └── dist/               # Vite build output (served by Caddy)
        ├── index.html
        ├── assets/
        │   ├── index-*.js
        │   └── index-*.css
        └── ...
```

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │                Internet                 │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Caddy (Docker)                                 │
│  - Terminates TLS                                                           │
│  - Serves static frontend from /srv/ontology-hub/frontend/dist              │
│  - Proxies /api/*, /admin/*, /health to backend                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ web network
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Backend (Docker)                                    │
│  - FastAPI application                                                      │
│  - Connects to PostgreSQL on internal network                              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ internal network
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL (Docker)                                  │
│  - Database with pgdata volume                                              │
│  - Only accessible from internal network                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```
