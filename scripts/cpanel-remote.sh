#!/usr/bin/env bash
set -euo pipefail

HOST_ALIAS="${HOST_ALIAS:-adhub-cpanel}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home3/johnn315/ad-hub.digital}"
REMOTE_RUN_SH="${REMOTE_RUN_SH:-/home3/johnn315/apps/minha-api/run.sh}"

usage() {
  echo "Uso: $0 {status|logs|restart|pull-restart|cmd} [comando]"
  exit 1
}

action="${1:-}"
shift || true

case "$action" in
  status)
    ssh "$HOST_ALIAS" "$REMOTE_RUN_SH status"
    ;;
  logs)
    ssh "$HOST_ALIAS" "$REMOTE_RUN_SH logs"
    ;;
  restart)
    ssh "$HOST_ALIAS" "$REMOTE_RUN_SH restart && $REMOTE_RUN_SH status"
    ;;
  pull-restart)
    ssh "$HOST_ALIAS" "cd '$REMOTE_PROJECT_DIR' && git pull && $REMOTE_RUN_SH restart && $REMOTE_RUN_SH status"
    ;;
  cmd)
    [[ $# -gt 0 ]] || usage
    ssh "$HOST_ALIAS" "$*"
    ;;
  *)
    usage
    ;;
esac

