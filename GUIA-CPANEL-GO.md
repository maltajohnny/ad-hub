# Guia cPanel (Go) — Passo a Passo

Este guia mostra como subir sua aplicacao Go manualmente no cPanel, rodar em background e manter o processo ativo com seguranca.

## Ambiente real (seu caso)

- Usuario cPanel: `johnn315`
- Home: `/home3/johnn315`
- Projeto sincronizado do GitHub: `/home3/johnn315/ad-hub.digital`
- Web root padrao: `/home3/johnn315/public_html`
- Pasta sugerida para processo Go: `/home3/johnn315/apps/minha-api`

> A partir daqui, sempre que vir `~/...`, no seu servidor isso significa `/home3/johnn315/...`.

## 1) Estrutura recomendada no servidor

No seu `HOME` (via Gerenciador de Arquivos), crie:

- `~/apps/minha-api/`
- `~/apps/minha-api/bin/`
- `~/apps/minha-api/logs/`

## 2) Gerar o binario Go na sua maquina

No projeto local:

```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o app-linux .
```

Se seu servidor for ARM (raro), use `GOARCH=arm64`.

Se preferir compilar no proprio servidor (quando Go estiver instalado), faca:

```bash
cd /home3/johnn315/ad-hub.digital
go build -o /home3/johnn315/apps/minha-api/bin/app .
```

## 3) Upload manual no cPanel

Envie para `~/apps/minha-api/`:

- binario `app-linux`
- arquivo `.env`
- arquivos extras que sua API precise

Depois renomeie/mova:

- `app-linux` -> `~/apps/minha-api/bin/app`

## 4) Permissoes

No terminal do cPanel:

```bash
chmod 755 ~/apps/minha-api/bin/app
chmod 600 ~/apps/minha-api/.env
mkdir -p ~/apps/minha-api/logs
```

## 5) Configurar variaveis de ambiente

Crie/edite `~/apps/minha-api/.env`:

```env
PORT=3041
SERPAPI_KEY=sua_chave_aqui
APP_ENV=production
```

## 6) Criar o script de controle (run.sh)

Crie `~/apps/minha-api/run.sh` com o conteudo abaixo:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/minha-api}"
BIN="${BIN:-$APP_DIR/bin/app}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
PID_FILE="${PID_FILE:-$APP_DIR/app.pid}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
LOG_OUT="${LOG_OUT:-$LOG_DIR/app.out.log}"
LOG_ERR="${LOG_ERR:-$LOG_DIR/app.err.log}"
DEFAULT_PORT="${DEFAULT_PORT:-3041}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"

mkdir -p "$LOG_DIR"

get_port_from_env() {
  if [[ -f "$ENV_FILE" ]]; then
    local p
    p="$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2- || true)"
    if [[ -n "${p:-}" ]]; then
      echo "$p"
      return
    fi
  fi
  echo "$DEFAULT_PORT"
}

PORT="$(get_port_from_env)"

is_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

check_health() {
  curl -fsS "http://${HEALTH_HOST}:${PORT}${HEALTH_PATH}" >/dev/null 2>&1
}

start() {
  if [[ ! -x "$BIN" ]]; then
    echo "ERRO: binario nao executavel: $BIN"
    exit 1
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERRO: .env nao encontrado: $ENV_FILE"
    exit 1
  fi
  if is_running; then
    echo "OK: ja rodando (PID $(cat "$PID_FILE"))"
    exit 0
  fi

  set -a
  source "$ENV_FILE"
  set +a

  nohup "$BIN" >>"$LOG_OUT" 2>>"$LOG_ERR" &
  echo $! > "$PID_FILE"
  sleep 1

  if ! is_running; then
    echo "ERRO: app caiu ao iniciar. Veja $LOG_ERR"
    rm -f "$PID_FILE"
    exit 1
  fi

  echo "OK: iniciado (PID $(cat "$PID_FILE"))"
}

stop() {
  if ! [[ -f "$PID_FILE" ]]; then
    echo "OK: nada para parar"
    exit 0
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" || true
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" || true
    fi
  fi
  rm -f "$PID_FILE"
  echo "OK: parado"
}

restart() {
  stop || true
  start
}

status() {
  if is_running; then
    echo "RUNNING PID $(cat "$PID_FILE")"
    if check_health; then
      echo "HEALTH OK: http://${HEALTH_HOST}:${PORT}${HEALTH_PATH}"
    else
      echo "HEALTH PENDENTE/ERRO"
    fi
  else
    echo "STOPPED"
    exit 1
  fi
}

logs() {
  touch "$LOG_OUT" "$LOG_ERR"
  tail -n 100 -f "$LOG_OUT" "$LOG_ERR"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) restart ;;
  status) status ;;
  logs) logs ;;
  *) echo "Uso: $0 {start|stop|restart|status|logs}" ; exit 1 ;;
esac
```

## 7) Dar permissao e iniciar

```bash
chmod +x ~/apps/minha-api/run.sh
~/apps/minha-api/run.sh start
~/apps/minha-api/run.sh status
```

## 8) Validar se esta no ar

```bash
curl -v http://127.0.0.1:3041/health
```

Se responder JSON da sua API, esta ok.

## 9) Ver logs

```bash
~/apps/minha-api/run.sh logs
```

Ou:

```bash
tail -f ~/apps/minha-api/logs/app.out.log
tail -f ~/apps/minha-api/logs/app.err.log
```

## 10) Manter em background automaticamente (Cron no cPanel)

No cPanel > **Cron Jobs**, adicione:

```bash
* * * * * /bin/bash -lc '$HOME/apps/minha-api/run.sh status >/dev/null 2>&1 || $HOME/apps/minha-api/run.sh start >/dev/null 2>&1'
```

Isso verifica a cada minuto e religa se cair.

## 11) Atualizar versao da API (deploy manual)

1. `~/apps/minha-api/run.sh stop`
2. Upload do novo binario (`app`) em `~/apps/minha-api/bin/`
3. `chmod 755 ~/apps/minha-api/bin/app`
4. `~/apps/minha-api/run.sh start`
5. `~/apps/minha-api/run.sh status`

### Fluxo apos `git push` (seu caso)

Quando o repositório ja tiver sido atualizado em `/home3/johnn315/ad-hub.digital`, rode:

```bash
cd /home3/johnn315/ad-hub.digital
git pull
go build -o /home3/johnn315/apps/minha-api/bin/app .
/home3/johnn315/apps/minha-api/run.sh restart
/home3/johnn315/apps/minha-api/run.sh status
```

## 12) Problemas comuns

- **Permissao negada ao binario**: rode `chmod 755`.
- **Nao sobe**: confira `.env` e logs em `app.err.log`.
- **Cai apos reinicio do servidor**: confirme cron ativo.
- **Health falha**: verifique se `PORT` no `.env` bate com a porta usada.

---

Se quiser, no proximo passo eu posso criar uma segunda versao deste guia com valores ja preenchidos para o seu app atual (porta, paths e endpoint exatos).
