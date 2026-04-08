#!/usr/bin/env bash
set -euo pipefail

#######################################
# Deploy local -> HostGator (shared hosting)
# - Build Go binary locally for Linux amd64
# - Upload binary and restart script
# - Restart app on remote server
#######################################

# ===== Config =====
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ssh_access}"
SSH_USER="${SSH_USER:-johnn315}"
SSH_HOST="${SSH_HOST:-162.241.2.132}"
REMOTE_DIR="${REMOTE_DIR:-/home3/johnn315/apps/minha-api}"
BIN_NAME="${BIN_NAME:-api}"
PROJECT_ROOT="$(pwd)"
BUILD_DIR="${PROJECT_ROOT}/.deploy"
LOCAL_BIN="${BUILD_DIR}/${BIN_NAME}"
LOCAL_RESTART_SCRIPT="./restart-api.sh"
DEFAULT_APP_SOURCE_DIR="."
if [ -f "./backend/intellisearch/main.go" ]; then
  DEFAULT_APP_SOURCE_DIR="./backend/intellisearch"
fi
APP_SOURCE_DIR="${APP_SOURCE_DIR:-$DEFAULT_APP_SOURCE_DIR}"

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

fail() {
  printf "\n[ERRO] %s\n" "$1" >&2
  exit 1
}

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatorio nao encontrado: $1"
}

log "Validando pre-requisitos locais..."
check_cmd go
check_cmd scp
check_cmd ssh

[ -f "$SSH_KEY" ] || fail "Chave SSH nao encontrada em: $SSH_KEY"
[ -d "$APP_SOURCE_DIR" ] || fail "Diretorio da aplicacao nao encontrado: $APP_SOURCE_DIR"
[ -f "$APP_SOURCE_DIR/go.mod" ] || fail "go.mod nao encontrado em: $APP_SOURCE_DIR"
[ -f "$APP_SOURCE_DIR/main.go" ] || fail "main.go nao encontrado em: $APP_SOURCE_DIR"
[ -f "$LOCAL_RESTART_SCRIPT" ] || fail "Script local $LOCAL_RESTART_SCRIPT nao encontrado."
mkdir -p "$BUILD_DIR"
log "Diretorio de build detectado: $APP_SOURCE_DIR"

log "PASSO 1/6 - Compilando binario Go para Linux amd64..."
(
  cd "$APP_SOURCE_DIR"
  GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "$LOCAL_BIN" .
)
[ -f "$LOCAL_BIN" ] || fail "Falha ao gerar binario $LOCAL_BIN"

log "PASSO 2/6 - Aplicando permissao de execucao no binario..."
chmod +x "$LOCAL_BIN"

log "PASSO 3/6 - Enviando binario e script de restart para o servidor..."
ssh -i "$SSH_KEY" "${SSH_USER}@${SSH_HOST}" "mkdir -p '${REMOTE_DIR}'"
scp -i "$SSH_KEY" "$LOCAL_BIN" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/${BIN_NAME}.new"
scp -i "$SSH_KEY" "$LOCAL_RESTART_SCRIPT" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/restart-api.sh.new"

log "PASSO 4/6 - Conectando via SSH para publicar versao..."
ssh -i "$SSH_KEY" "${SSH_USER}@${SSH_HOST}" "set -euo pipefail; \
  mkdir -p '${REMOTE_DIR}'; \
  cd '${REMOTE_DIR}'; \
  chmod +x '${BIN_NAME}.new' 'restart-api.sh.new'; \
  mv -f 'restart-api.sh.new' 'restart-api.sh'; \
  if [ -f '${BIN_NAME}' ]; then mv -f '${BIN_NAME}' '${BIN_NAME}.bak'; fi; \
  mv -f '${BIN_NAME}.new' '${BIN_NAME}'; \
  chmod +x '${BIN_NAME}' 'restart-api.sh'"

log "PASSO 5/6 - Reiniciando API remotamente..."
ssh -i "$SSH_KEY" "${SSH_USER}@${SSH_HOST}" "set -euo pipefail; \
  cd '${REMOTE_DIR}'; \
  ./restart-api.sh '${BIN_NAME}'"

log "PASSO 6/6 - Verificando status remoto..."
ssh -i "$SSH_KEY" "${SSH_USER}@${SSH_HOST}" "set -euo pipefail; \
  cd '${REMOTE_DIR}'; \
  pgrep -af './${BIN_NAME}' || true; \
  echo '--- Ultimas linhas de app.log ---'; \
  if [ -f app.log ]; then tail -n 20 app.log; else echo 'app.log ainda nao existe.'; fi"

log "Deploy concluido com sucesso."
