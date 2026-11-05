#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> Move Hermes webhook off port 80 -> 127.0.0.1:8081"
python3 - <<'PY'
from pathlib import Path
p = Path('/root/.hermes/scripts/hermes_webhook_proxy.py')
text = p.read_text()
old = 'LISTEN = ("0.0.0.0", 80)'
new = 'LISTEN = ("127.0.0.1", 8081)'
if old in text:
    p.write_text(text.replace(old, new, 1))
    print('hermes LISTEN updated to 127.0.0.1:8081')
elif new in text:
    print('hermes already on 8081')
else:
    raise SystemExit('LISTEN line not found as expected')
PY

export XDG_RUNTIME_DIR=/run/user/0
systemctl --user restart hermes-webhook-proxy.service
sleep 2
systemctl --user is-active hermes-webhook-proxy.service
ss -tlnp | grep -E ':80 |:8081 ' || true

echo "==> Install nginx + certbot"
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> Write nginx config"
cat > /etc/nginx/sites-available/nd-dashboard <<'EOF'
# Project dashboard on custom domain
server {
    listen 80;
    listen [::]:80;
    server_name nd-dashboard.cloud www.nd-dashboard.cloud;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}

# Keep Hermes webhook reachable via server IP on port 80
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/nd-dashboard /etc/nginx/sites-enabled/nd-dashboard
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw allow 80/tcp || true
ufw allow 443/tcp || true

echo "==> listeners"
ss -tlnp | grep -E ':80 |:443 |:8080 |:8081 ' || true

echo "==> local tests"
curl -sS -o /dev/null -w 'dash_host %{http_code}\n' -H 'Host: nd-dashboard.cloud' http://127.0.0.1/
curl -sS -o /dev/null -w 'ip_default %{http_code}\n' http://127.0.0.1/
curl -sS -o /dev/null -w 'direct8080 %{http_code}\n' http://127.0.0.1:8080/api/health

echo "==> HTTPS certbot"
if certbot --nginx -d nd-dashboard.cloud -d www.nd-dashboard.cloud --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  echo CERTBOT_OK
else
  echo CERTBOT_FAILED_HTTP_ONLY
fi

echo NGINX_READY
