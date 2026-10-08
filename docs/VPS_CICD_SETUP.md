# VPS CI/CD setup (GitHub Actions → Docker Compose)

Auto-deploy runs on every push to `main` (and via **Actions → Deploy VPS → Run workflow**).

## One-time setup on the VPS

```bash
cd /opt/project-dashboard
git pull --ff-only
bash scripts/setup-github-deploy-key.sh
```

Copy the printed values into GitHub.

## GitHub secrets

Repo: **Settings → Secrets and variables → Actions**  
(or Environment **production** → Environment secrets)

| Secret | Example | Required |
|--------|---------|----------|
| `VPS_HOST` | VPS public IP or hostname | yes |
| `VPS_USER` | `root` or deploy user | yes |
| `VPS_SSH_PRIVATE_KEY` | full `ed25519` private key | yes |
| `VPS_PORT` | `22` | no (default 22) |
| `VPS_APP_DIR` | `/opt/project-dashboard` | no |
| `VPS_HEALTH_URL` | `https://nd-dashboard.cloud/api/health` | recommended |

Also create Environment named **`production`** (Settings → Environments).

## First-time app bootstrap (if server empty)

```bash
bash scripts/deploy-vps.sh
# edit /opt/project-dashboard/.env with real Supabase keys, then re-run
```

`.env` stays **only on the server** (never commit).

## Flow after setup

1. Push to `main` (or run workflow manually)
2. GitHub Actions SSHs to VPS
3. `git fetch` + `reset --hard origin/main`
4. `docker compose up -d --build`
5. Wait for `/api/health`
6. Optional public health check via `VPS_HEALTH_URL`

## Manual redeploy on server

```bash
cd /opt/project-dashboard
bash scripts/deploy-vps.sh
```
