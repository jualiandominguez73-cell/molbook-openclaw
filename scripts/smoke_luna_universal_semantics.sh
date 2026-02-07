#!/usr/bin/env bash
set -euo pipefail

PROOF_DIR=${PROOF_DIR:-/home/dado/PROOF/luna_universal_semantics_20260207T110435Z}
mkdir -p "${PROOF_DIR}"

echo "${PROOF_DIR}" > "${PROOF_DIR}/PROOF_DIR.txt"

docker compose restart openclaw-gateway > "${PROOF_DIR}/restart.txt" 2>&1

echo "== health wait ==" > "${PROOF_DIR}/health_wait.log"
for i in $(seq 1 30); do
  status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/health || true)
  echo "attempt ${i}: ${status}" >> "${PROOF_DIR}/health_wait.log"
  if [[ "${status}" == "200" ]]; then
    break
  fi
  sleep 1
done

docker logs --tail 250 openclaw-openclaw-gateway-1 > "${PROOF_DIR}/gateway_logs_after_restart.txt" 2>&1 || true

if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" && -f "/home/dado/openclaw/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "/home/dado/openclaw/.env"
  set +a
fi

export PROOF_DIR

node /home/dado/openclaw/scripts/universal_semantics_proof.mjs | tee "${PROOF_DIR}/smoke.log"
