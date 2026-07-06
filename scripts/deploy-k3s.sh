#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_HOST="${DEPLOY_HOST:-ubuntu}"
REMOTE_DIR="${DEPLOY_DIR:-~/relayhub-transfer-station.new}"
ARCHIVE_PATH="${DEPLOY_ARCHIVE:-/tmp/transfer-station-deploy.tgz}"
NAMESPACE="${DEPLOY_NAMESPACE:-relayhub}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-relayhub}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://relayhub.chrisley.site/api/health}"
RUN_SEED="${DEPLOY_RUN_SEED:-0}"

echo "==> Packaging source from ${ROOT_DIR}"
rm -f "${ARCHIVE_PATH}"
COPYFILE_DISABLE=1 bsdtar --no-xattrs --no-mac-metadata \
  -czf "${ARCHIVE_PATH}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'data' \
  --exclude '.DS_Store' \
  -C "$(dirname "${ROOT_DIR}")" \
  "$(basename "${ROOT_DIR}")"

echo "==> Uploading archive to ${REMOTE_HOST}"
scp "${ARCHIVE_PATH}" "${REMOTE_HOST}:~/transfer-station-deploy.tgz"

echo "==> Building and rolling out on ${REMOTE_HOST}"
ssh "${REMOTE_HOST}" "set -euo pipefail
rm -rf ${REMOTE_DIR}
mkdir -p ${REMOTE_DIR}
tar -xzf ~/transfer-station-deploy.tgz -C ${REMOTE_DIR} --strip-components=1
cd ${REMOTE_DIR}
sudo docker build -t relayhub:latest .
sudo docker save relayhub:latest | sudo k3s ctr images import -
sudo k3s kubectl apply -f k8s/relayhub.yaml
sudo k3s kubectl -n ${NAMESPACE} rollout restart deployment/${DEPLOYMENT_NAME}
sudo k3s kubectl -n ${NAMESPACE} rollout status deployment/${DEPLOYMENT_NAME} --timeout=180s
if [ \"${RUN_SEED}\" = \"1\" ]; then
  sudo k3s kubectl -n ${NAMESPACE} exec deploy/${DEPLOYMENT_NAME} -c relayhub -- node dist/server/seed.js
fi
sudo k3s kubectl -n ${NAMESPACE} get pods -o wide
sudo k3s kubectl -n ${NAMESPACE} logs deploy/${DEPLOYMENT_NAME} -c relayhub --tail=40
"

echo "==> Checking public health: ${HEALTH_URL}"
curl -k -I --max-time 15 "${HEALTH_URL}"

echo "==> Deploy complete"
