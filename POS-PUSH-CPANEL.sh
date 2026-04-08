#!/usr/bin/env bash
set -euo pipefail

# Script para executar no servidor cPanel apos atualizar o repositorio.
# Caminhos do seu ambiente (johnn315 / home3):
PROJECT_DIR="/home3/johnn315/ad-hub.digital"
APP_BIN="/home3/johnn315/apps/minha-api/bin/app"
RUN_SH="/home3/johnn315/apps/minha-api/run.sh"

echo "[1/5] Indo para o projeto..."
cd "$PROJECT_DIR"

echo "[2/5] Atualizando codigo..."
git pull

echo "[3/5] Gerando binario Go..."
go build -o "$APP_BIN" .
chmod 755 "$APP_BIN"

echo "[4/5] Reiniciando servico..."
"$RUN_SH" restart

echo "[5/5] Status final..."
"$RUN_SH" status

echo "OK: deploy/restart concluido."

