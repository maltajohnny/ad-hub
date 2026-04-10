#!/usr/bin/env bash
# Reinicia a API Go na HostGator (mata api + porta, ./restart-api.sh, curl ping).
# Uso na raiz do repo: chmod +x scripts/hostgator-remote-restart.sh && ./scripts/hostgator-remote-restart.sh
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/ssh_access}"
SSH_OPTS=( -o IdentitiesOnly=yes -o ConnectTimeout=20 )
SSH_USER="${SSH_USER:-johnn315}"
SSH_HOST="${SSH_HOST:-162.241.2.132}"
REMOTE_DIR="${REMOTE_DIR:-/home3/johnn315/apps/minha-api}"

ssh_deploy() {
  env -u SSH_AUTH_SOCK -u SSH_AGENT_PID ssh "${SSH_OPTS[@]}" -i "$SSH_KEY" "$@"
}

ssh_deploy "${SSH_USER}@${SSH_HOST}" bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
pkill -9 -f 'apps/minha-api/api' 2>/dev/null || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${REMOTE_DIR}/api" 2>/dev/null || true
  fuser -k 3041/tcp 2>/dev/null || true
  fuser -k 3042/tcp 2>/dev/null || true
fi
sleep 2
./restart-api.sh
echo '--- ping 3041 ---'
curl -sS -m 15 http://127.0.0.1:3041/api/intellisearch/ping || echo '(curl 3041 falhou)'
echo
EOF
