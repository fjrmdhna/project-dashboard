#!/usr/bin/env bash
# Deploy / redeploy project-dashboard on a VPS with Docker Compose.
# Usage (on the server):
#   bash scripts/deploy-vps.sh
#
# Prereq: /opt/project-dashboard/.env filled with Supabase (and optional Redis) keys.
#
# Env overrides:
#   REPO_URL, APP_DIR, HEALTH_URL, SKIP_UFW=1, CI=1

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/fjrmdhna/project-dashboard.git}"
APP_DIR="${APP_DIR:-/opt/project-dashboard}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"
BRANCH="${BRANCH:-main}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "ERROR: docker compose not found"
    exit 1
  fi
}

echo "==> Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER" || true
  echo "Docker installed. If 'permission denied' on docker, log out/in SSH once."
fi

echo "==> Preparing app directory: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Cloning repository"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "==> Syncing repository to origin/${BRANCH}"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ""
    echo "Created .env from .env.example."
    echo "Edit it with your Supabase/Redis keys, then re-run:"
    echo "  nano $APP_DIR/.env"
    echo "  bash $APP_DIR/scripts/deploy-vps.sh"
    exit 1
  else
    echo "ERROR: No .env found. Create $APP_DIR/.env with Supabase keys."
    exit 1
  fi
fi

if ! grep -q '^NEXT_PUBLIC_SUPABASE_URL=.\+' .env; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL is empty in .env. Fill it before deploying."
  exit 1
fi

if [ "${SKIP_UFW:-0}" != "1" ] && [ "${CI:-0}" != "1" ]; then
  echo "==> Opening firewall port 8080 (if ufw is active)"
  if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 8080/tcp || true
    sudo ufw reload || true
  fi
fi

echo "==> Checking port 8080"
PORT_BUSY=0
if command -v ss >/dev/null 2>&1 && ss -tlnp | grep -q ':8080 '; then
  PORT_BUSY=1
fi

if [ "$PORT_BUSY" -eq 1 ]; then
  # Redeploy is OK when our own compose stack already owns 8080.
  if compose ps --status running 2>/dev/null | grep -Eq 'project_dashboard_app|app'; then
    echo "Port 8080 is used by existing project-dashboard app — continuing redeploy."
  else
    echo "WARNING: Port 8080 is already in use by another process."
    echo "See what is using it:"
    echo "  sudo ss -tlnp | grep ':8080 '"
    ss -tlnp | grep ':8080 ' || true
    exit 1
  fi
fi

echo "==> Building and starting containers"
compose up -d --build --remove-orphans

echo "==> Waiting for health: $HEALTH_URL"
ok=0
for i in $(seq 1 36); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    echo "Health OK (attempt $i)"
    break
  fi
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo "ERROR: App did not become healthy within timeout."
  compose ps || true
  compose logs --tail=80 app || true
  exit 1
fi

echo "==> Status"
compose ps

echo ""
echo "Done."
echo "Local health: $HEALTH_URL"
echo "Public (if nginx configured): https://nd-dashboard.cloud/api/health"
echo "Logs: cd $APP_DIR && docker compose logs -f app"
