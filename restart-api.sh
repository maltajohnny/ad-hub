#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   ./restart-api.sh            # usa binario "api"
#   ./restart-api.sh meu-bin    # usa outro nome de binario

BIN_NAME="${1:-api}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${APP_DIR}/app.log"
PIDFILE="${APP_DIR}/${BIN_NAME}.pid"

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

fail() {
  printf "\n[ERRO] %s\n" "$1" >&2
  exit 1
}

cd "$APP_DIR"

[ -f "./${BIN_NAME}" ] || fail "Binario nao encontrado: ${APP_DIR}/${BIN_NAME}"
chmod +x "./${BIN_NAME}"

# Porta onde a API escuta (deve bater com main.go e public/api/intellisearch/proxy.php — predef. 3041)
PORT="3041"
if [ -f ".env" ]; then
  line="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' .env 2>/dev/null | tail -n 1 || true)"
  if [ -n "${line:-}" ]; then
    val="${line#*=}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    [ -n "$val" ] && PORT="$val"
  fi
fi

# Junta PIDs que estao em LISTEN na porta TCP (varias ferramentas — jailshell muitas vezes nao tem lsof).
pids_listening_on_tcp_port() {
  local p="$1"
  local acc="" line
  if command -v lsof >/dev/null 2>&1; then
    acc="$(lsof -t -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    # Jailshell: as vezes so aparece com filtro mais largo
    acc="${acc} $(lsof -t -nP -iTCP:"$p" 2>/dev/null || true)"
  fi
  if command -v ss >/dev/null 2>&1; then
    while IFS= read -r line; do
      [[ "$line" =~ pid=([0-9]+) ]] || continue
      acc="${acc} ${BASH_REMATCH[1]}"
    done < <(ss -ltnp "sport = :${p}" 2>/dev/null || true)
  fi
  if command -v netstat >/dev/null 2>&1; then
    while IFS= read -r line; do
      case "$line" in
        *:"$p"*) ;;
        *) continue ;;
      esac
      # Coluna tipica: ... 0.0.0.0:3041 ... 12345/api
      tok="$(echo "$line" | awk '{print $NF}')"
      tok="${tok%%/*}"
      if [[ "$tok" =~ ^[0-9]+$ ]]; then
        acc="${acc} ${tok}"
      fi
    done < <(netstat -tlnp 2>/dev/null || true)
  fi
  echo "$acc" | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u
}

tcp_port_in_use() {
  local p="$1"
  # NÃO usar grep cego em ":PORT" sobre ss -tlnp — no jailshell a linha users:(...,pid=IGUAL_À_PORTA,...)
  # pode coincidir com a porta e manter a porta "ocupada" para sempre.
  if command -v ss >/dev/null 2>&1; then
    if ss -ltnH "sport = :${p}" 2>/dev/null | grep -q .; then
      return 0
    fi
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  # Confirmação: ligação TCP real a 127.0.0.1 (se aceitar, há listener).
  if (true >/dev/tcp/127.0.0.1/"$p") 2>/dev/null; then
    return 0
  fi
  return 1
}

# Apos `mv api.new api`, o processo antigo pode manter o socket na porta com o binario "(deleted)" no /proc — fuser no ficheiro novo nao o ve.
kill_matching_exe_in_proc() {
  [ -d /proc ] || return 0
  local pid exe needle="${APP_DIR}/${BIN_NAME}"
  for pid in $(pgrep -u "$(id -u)" 2>/dev/null || true); do
    exe="$(readlink "/proc/${pid}/exe" 2>/dev/null || true)"
    case "$exe" in
      "${needle}" | "${needle} (deleted)" | *"/${BIN_NAME} (deleted)")
        kill -9 "$pid" 2>/dev/null || true
        ;;
    esac
  done
}

# No jailshell, `ss`/`lsof -i` muitas vezes nao mostram pid=; matar por ficheiro do binario costuma funcionar.
kill_holders_of_binary() {
  local binpath="${APP_DIR}/${BIN_NAME}"
  local pid pids
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$binpath" 2>/dev/null || true
    sleep 1
    fuser -k "$binpath" 2>/dev/null || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -t "$binpath" 2>/dev/null || true)"
    for pid in $pids; do
      [ -z "${pid:-}" ] && continue
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

free_port() {
  local p="$1"
  local i pid pids
  # Jailshell/HostGator: lsof/ss muitas vezes não mostram PID; fuser na porta TCP + kills repetidos.
  # Pode demorar ~30–90s no pior caso — não é travamento.
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    case "$i" in 1 | 5 | 10 | 15 | 20) log "  porta ${p}: tentativa ${i}/20 (aguarde)..." ;; esac
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "${p}/tcp" 2>/dev/null || true
    fi
    kill_matching_exe_in_proc
    kill_holders_of_binary
    pids="$(pids_listening_on_tcp_port "$p" || true)"
    for pid in $pids; do
      [ -z "${pid:-}" ] && continue
      kill -9 "$pid" 2>/dev/null || true
    done
    sleep 1
    if ! tcp_port_in_use "$p"; then
      return 0
    fi
  done
  log "AVISO: porta ${p} ainda ocupada após 20 tentativas; SSH: fuser -k ${p}/tcp; fuser -k ${APP_DIR}/${BIN_NAME}"
  return 1
}

log "Parando processo anterior (se existir)..."
if [ -f "$PIDFILE" ]; then
  old_pid="$(tr -d '[:space:]' <"$PIDFILE" 2>/dev/null || true)"
  if [ -n "${old_pid:-}" ] && kill -0 "$old_pid" 2>/dev/null; then
    log "Encerrando PID guardado em ${PIDFILE}: ${old_pid}"
    kill -9 "$old_pid" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDFILE"
fi

MATCH_EXPR="${APP_DIR}/${BIN_NAME}|\\./${BIN_NAME}|minha-api/${BIN_NAME}"

if pgrep -f "$MATCH_EXPR" >/dev/null 2>&1; then
  pkill -f "$MATCH_EXPR" || true
  sleep 1
fi

if pgrep -f "$MATCH_EXPR" >/dev/null 2>&1; then
  log "Processo ainda ativo, forcando encerramento..."
  pkill -9 -f "$MATCH_EXPR" || true
  sleep 1
fi

kill_matching_exe_in_proc
pkill -9 -u "$(id -u)" -f "${APP_DIR}/${BIN_NAME}" 2>/dev/null || true
sleep 1
kill_holders_of_binary
sleep 1

log "Liberando porta ${PORT} (pode demorar até ~1–2 min no jailshell; não cancele)..."
if ! free_port "$PORT"; then
  log "Segunda sequência de libertação da porta ${PORT}..."
  sleep 3
  free_port "$PORT" || fail "Porta ${PORT} ainda ocupada. Por SSH: cd ${APP_DIR} && fuser -k ${PORT}/tcp && fuser -k ./${BIN_NAME} && sleep 2 && ./restart-api.sh"
fi
if tcp_port_in_use "$PORT"; then
  fail "Porta ${PORT} ainda em uso (verificação final). Não vou iniciar outro processo."
fi

if pgrep -f "$MATCH_EXPR" >/dev/null 2>&1; then
  fail "Nao foi possivel parar o processo antigo."
fi

log "Iniciando nova instancia em background..."
nohup "./${BIN_NAME}" >"$LOG_FILE" 2>&1 &
NEW_PID=$!
sleep 1

if kill -0 "$NEW_PID" >/dev/null 2>&1; then
  printf '%s\n' "$NEW_PID" >"$PIDFILE"
  log "API iniciada com sucesso."
  log "PID: $NEW_PID"
  log "Log: ${LOG_FILE}"
else
  if [ -f "$LOG_FILE" ]; then
    log "Ultimas linhas do log:"
    tail -n 20 "$LOG_FILE" || true
  fi
  fail "Falha ao iniciar a API. Verifique ${LOG_FILE}"
fi
