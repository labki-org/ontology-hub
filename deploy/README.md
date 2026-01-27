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

Edit to match your network name (if different from `web`):

```bash
nano docker-compose.prod.yml
```

Change `caddy` to `web` in the networks section:
```yaml
networks:
  internal:
  web:
    external: true
```

And update the backend service:
```yaml
    networks:
      - internal
      - web
```

### 3. Create Environment File

```bash
nano /srv/ontology-hub/.env
```

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

Append to your Caddyfile:

```caddyfile
ontology.labki.org {
    root * /srv/ontology-hub/frontend/dist
    encode gzip zstd

    handle /api/* {
        reverse_proxy backend:8000
    }
    handle /health {
        reverse_proxy backend:8000
    }
    handle /admin/* {
        reverse_proxy backend:8000
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
docker compose restart caddy
```

### 5. Deploy Frontend (First Time)

```bash
gh run download --repo labki-org/ontology-hub --name frontend-dist --dir /tmp/frontend-dist
cp -r /tmp/frontend-dist/* /srv/ontology-hub/frontend/dist/
rm -rf /tmp/frontend-dist
```

### 6. Start Backend Services

```bash
cd /srv/ontology-hub
docker compose -f docker-compose.prod.yml up -d
```

### 7. Initialize Database

Trigger the initial sync from GitHub:

```bash
curl -X POST https://ontology.labki.org/admin/sync-v2
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
```

Visit https://ontology.labki.org in your browser.

---

## Automated Deployments (CI/CD)

The `.github/workflows/deploy.yml` workflow automatically deploys on push to main.

### Required GitHub Secrets

Set these in your repo settings (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Your VPS IP address or hostname |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key (ed25519 or RSA) |

### Generate SSH Key (if needed)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-vps

# Add private key content to GitHub secret VPS_SSH_KEY
cat ~/.ssh/id_ed25519
```

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
gh run download --repo labki-org/ontology-hub --name frontend-dist --dir /tmp/frontend-dist
rm -rf /srv/ontology-hub/frontend/dist/*
cp -r /tmp/frontend-dist/* /srv/ontology-hub/frontend/dist/
rm -rf /tmp/frontend-dist
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check database connection
docker compose -f docker-compose.prod.yml logs db
```

### Caddy can't reach backend

Ensure both containers are on the same network:

```bash
docker network inspect web
```

Both `caddy` and `backend` should be listed.

### Frontend shows blank page

Check browser console for errors. Common issues:
- API URL mismatch (check CORS_ORIGINS)
- Frontend files not deployed (check `/srv/ontology-hub/frontend/dist/`)

### OAuth redirect fails

Verify:
- `FRONTEND_URL` matches your domain exactly
- GitHub OAuth app callback URL is set to `https://ontology.labki.org/api/v1/auth/callback`

---

## Directory Structure

```
/srv/ontology-hub/
├── docker-compose.prod.yml
├── .env
└── frontend/
    └── dist/           # Vite build output (served by Caddy)
        ├── index.html
        ├── assets/
        └── ...
```
