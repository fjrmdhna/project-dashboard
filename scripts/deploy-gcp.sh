#!/usr/bin/env bash
# Deploy project-dashboard to GCP Cloud Run (source-based build).
# Matches IOH ACE AIP org constraints:
#   - region asia-southeast2
#   - Artifact Registry cloud-run-source-deploy
#   - Cloud Run SA for both runtime + build (default Compute SA is disabled)
#
# Usage:
#   export NEXT_PUBLIC_SUPABASE_URL=...
#   export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   bash scripts/deploy-gcp.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-aip-el-u045-ca-prd-ee7e}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-project-dashboard}"
CLOUD_RUN_SA="${CLOUD_RUN_SA:-sa-aip-prd-el-u045-ca-crn@${PROJECT_ID}.iam.gserviceaccount.com}"
BUILD_SA="${BUILD_SA:-projects/${PROJECT_ID}/serviceAccounts/${CLOUD_RUN_SA}}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?Set NEXT_PUBLIC_SUPABASE_URL}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set NEXT_PUBLIC_SUPABASE_ANON_KEY}"

ENV_VARS="NODE_ENV=production"
ENV_VARS+=",NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
ENV_VARS+=",NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
BUILD_ENV="NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
BUILD_ENV+=",NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  ENV_VARS+=",SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
fi
if [[ -n "${UPSTASH_REDIS_REST_URL:-}" && -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]]; then
  ENV_VARS+=",UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}"
  ENV_VARS+=",UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}"
fi

echo "==> Project: ${PROJECT_ID}"
echo "==> Region:  ${REGION}"
echo "==> Service: ${SERVICE}"
echo "==> Deploying via Cloud Run source build..."

gcloud run deploy "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --source=. \
  --service-account="${CLOUD_RUN_SA}" \
  --build-service-account="${BUILD_SA}" \
  --port=8080 \
  --cpu=2 \
  --memory=2Gi \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --cpu-boost \
  --ingress=all \
  --set-build-env-vars="${BUILD_ENV}" \
  --set-env-vars="${ENV_VARS}" \
  --quiet

echo "==> Service URL:"
gcloud run services describe "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)'

echo ""
echo "Note: this org usually blocks public (allUsers) invoker."
echo "Ask a project admin to grant roles/run.invoker to allUsers, or open via:"
echo "  gcloud run services proxy ${SERVICE} --region ${REGION} --project ${PROJECT_ID}"
