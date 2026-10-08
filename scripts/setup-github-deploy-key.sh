#!/usr/bin/env bash
# Run ONCE on the VPS to create a dedicated GitHub Actions deploy key.
# Usage:
#   bash scripts/setup-github-deploy-key.sh
#
# Then add the printed private key + host values as GitHub Actions secrets.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-$USER}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/github_actions_deploy}"
APP_DIR="${APP_DIR:-/opt/project-dashboard}"

echo "==> Creating ed25519 deploy key at ${KEY_PATH}"
mkdir -p "$(dirname "$KEY_PATH")"
chmod 700 "$(dirname "$KEY_PATH")"

if [ -f "$KEY_PATH" ]; then
  echo "Key already exists: $KEY_PATH (not overwriting)"
else
  ssh-keygen -t ed25519 -N "" -C "github-actions-deploy@$(hostname)" -f "$KEY_PATH"
fi

PUB_KEY="$(cat "${KEY_PATH}.pub")"
AUTH_KEYS="$HOME/.ssh/authorized_keys"
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"

if ! grep -qxF "$PUB_KEY" "$AUTH_KEYS"; then
  echo "$PUB_KEY" >> "$AUTH_KEYS"
  echo "Public key appended to $AUTH_KEYS"
else
  echo "Public key already present in authorized_keys"
fi

# Ensure deploy user can run docker without interactive group refresh issues
if ! groups "$DEPLOY_USER" | grep -q docker; then
  echo "==> Adding $DEPLOY_USER to docker group (re-login may be required)"
  sudo usermod -aG docker "$DEPLOY_USER" || true
fi

HOST_IP="$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
echo "==================== GitHub Secrets ===================="
echo "Add these repository secrets (Settings → Secrets → Actions):"
echo ""
echo "VPS_HOST=${HOST_IP}"
echo "VPS_USER=${DEPLOY_USER}"
echo "VPS_PORT=22"
echo "VPS_APP_DIR=${APP_DIR}"
echo ""
echo "VPS_SSH_PRIVATE_KEY=  (paste FULL private key below, including BEGIN/END lines)"
echo "-----BEGIN OPENSSH PRIVATE KEY-----"
echo "(see file: ${KEY_PATH})"
echo "-----END OPENSSH PRIVATE KEY-----"
echo ""
echo "Private key file contents:"
echo "------------------------------------------------------------"
cat "$KEY_PATH"
echo "------------------------------------------------------------"
echo ""
echo "Optional public health check secret:"
echo "VPS_HEALTH_URL=https://nd-dashboard.cloud/api/health"
echo "============================================================"
