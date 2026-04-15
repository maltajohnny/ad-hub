# Corrigir IntelliSearch (AD-HUB)

Guia rápido para quando o IntelliSearch falha em **ad-hub.digital** ou o `curl` à API devolve **Connection refused**.

---

## 1) Sintoma mais comum: API Go parada (`Connection refused`)

Se por SSH:

```bash
curl -sS -m 5 http://127.0.0.1:3041/api/intellisearch/ping
```

responde **`Connection refused`** (e o mesmo para o IP público `:3041`), **não há processo a escutar na porta 3041**. O site e o proxy PHP só funcionam **depois** da API estar a correr.

### Passos no servidor (SSH / jailshell)

```bash
cd ~/apps/minha-api
ls -la api .env restart-api.sh 2>/dev/null || ls -la
```

Se existir o binário **`api`** e o **`restart-api.sh`**:

```bash
chmod +x api restart-api.sh
./restart-api.sh api
```

Confirma:

```bash
sleep 2
curl -sS -m 5 http://127.0.0.1:3041/api/intellisearch/ping
```

Deves ver JSON com `"ok": true` (ou equivalente).

Se o arranque falhar:

```bash
tail -n 40 ~/apps/minha-api/app.log
```

(Revisa `SERPAPI_KEY`, `MYSQL_DSN`, `ADHUB_JWT_SECRET`, `PORT`, etc. no `.env` **nessa pasta**, ao lado do binário.)

### Se não existir binário `api` no servidor

No **Mac**, na raiz do repositório (com SSH/chave configurados):

```bash
./deploy-hostgator.sh
```

Envia o binário Linux para `~/apps/minha-api` e reinicia a API.

---

## 2) Erro no browser: `proxy: API Go inacessível` (mas o `curl` por SSH ao 3041 funciona)

Neste caso o **PHP** do site (HostGator / CageFS) muitas vezes **não consegue** falar com `127.0.0.1:3041` mesmo com o Go a correr.

### O que já foi feito no código (Git / deploy automático)

- **`public/api/intellisearch/proxy.php`** e **`public/api/ad-hub/proxy.php`**:
  - Ordem: `backend.local.php` → `INTELLISEARCH_BACKEND` / `ADHUB_GO_BACKEND` → `INTELLISEARCH_BIND_EXTRA` / `ADHUB_GO_BIND_EXTRA` (SetEnv no `.htaccess`) → para host `ad-hub.digital` / `www` tenta **hairpin** `http://162.241.2.132:3041` → depois loopback e `SERVER_ADDR`, **só porta 3041** (removida a legado **3042**).
- **`public/api/intellisearch/.htaccess`** e **`public/api/ad-hub/.htaccess`**: `SetEnv` com `BIND_EXTRA` / IP público quando aplicável.
- **`public/.htaccess`**: regra para **`/api/slack-webhook`** → `slack-webhook.php` (relay Slack).
- **`public/api/slack-webhook.php`**: relay POST para o Slack (produção estática).
- **`src/services/slackReportService.ts`**: validação estrita da resposta JSON do relay (evita “sucesso” falso com HTML da SPA).
- **`src/lib/intellisearchApi.ts`**: em produção pode usar **`VITE_INTELLISEARCH_API_URL`** (GitHub Actions → Variables) para o browser falar **direto** com a API em **HTTPS** (subdomínio), sem depender do PHP→Go.
- **Modal Clientes / Dialog**: prop **`disableInnerScroll`** para não cortar conteúdo a 100% zoom (`src/components/ui/dialog.tsx`, `Clientes.tsx`, etc.).

### Plano B estável (quando nem hairpin nem IP público resolvem a partir do PHP)

1. Subdomínio **HTTPS** (ex. `api.ad-hub.digital`) com reverse proxy para `http://127.0.0.1:3041`.
2. No GitHub: **Actions → Variables** → `VITE_INTELLISEARCH_API_URL` = `https://api.ad-hub.digital` (sem barra final).
3. Push / re-run do workflow para rebuild.

(O Go já tem CORS permissivo para chamadas do browser.)

---

## 2b) Local: `SERPAPI_KEY ausente` mas a linha existe no `.env` da raiz

Se tens **`~/apps/minha-api/.env`** no Mac (por exemplo cópia do servidor) **sem** `SERPAPI_KEY` ou com valor vazio, versões antigas do backend carregavam esse ficheiro **por último** e apagavam a chave boa da raiz do repo.

O código atual **já não** carrega `~/apps/minha-api/.env` nessa situação; na mesma, apaga ou corrige o ficheiro em `~/apps/minha-api/.env` e **reinicia** a API:

```bash
# na raiz do repo
npm run intellisearch-api
# ou
npm run dev:with-api
```

---

## 3) Checklist rápido

| Verificação | Esperado |
|-------------|----------|
| `curl http://127.0.0.1:3041/api/intellisearch/ping` por SSH | JSON `ok` |
| Se recusar ligação | `./restart-api.sh` ou `./deploy-hostgator.sh` |
| Site ainda com proxy inacessível mas `curl` OK | PHP isolado → `VITE_INTELLISEARCH_API_URL` HTTPS ou suporte hosting |

---

## Referências no repo

- Deploy API: `deploy-hostgator.sh`
- Restart remoto: `restart-api.sh` (também em `~/apps/minha-api` no servidor)
- Guia cPanel / Go: `GUIA-CPANEL-GO.md`
- Deploy front (FTP automático): `.github/workflows/deploy-hostgator.yml` — **push em `main`** dispara build + deploy do `dist/`

---

*Documento criado a pedido: comandos SSH de verificação/restart da API e resumo das alterações no projeto relacionadas com IntelliSearch, proxy PHP, Slack e modal.*
