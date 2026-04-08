# SSH para cPanel (ad-hub.digital)

Este diretório contém um modelo pronto para configurar acesso SSH ao seu servidor cPanel.

## Seu cenário

- Home no servidor: `/home3/johnn315`
- Projeto sincronizado via git: `/home3/johnn315/ad-hub.digital`
- Web root tradicional: `/home3/johnn315/public_html`

## 1) Gerar chave SSH local (na sua máquina)

```bash
ssh-keygen -t ed25519 -C "deploy@ad-hub.digital" -f ~/.ssh/id_ed25519_adhub
```

Isso cria:

- `~/.ssh/id_ed25519_adhub` (privada)
- `~/.ssh/id_ed25519_adhub.pub` (pública)

## 2) Cadastrar chave no cPanel

No cPanel:

1. **Security > SSH Access > Manage SSH Keys**
2. Importe a chave pública (`id_ed25519_adhub.pub`)
3. Clique em **Authorize**

## 3) Configurar `~/.ssh/config`

Copie o conteúdo de `config.example` para seu `~/.ssh/config` local:

```bash
cp /caminho/do/projeto/.ssh/config.example ~/.ssh/config
chmod 600 ~/.ssh/config
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519_adhub
```

## 4) Testar conexão

```bash
ssh adhub-cpanel
```

Se conectar, a base está pronta.

## 5) Comandos úteis no servidor

Entrar no projeto:

```bash
cd /home3/johnn315/ad-hub.digital
```

Ver status do git:

```bash
git status
git log --oneline -n 5
```

Build e restart da API (exemplo):

```bash
cd /home3/johnn315/ad-hub.digital
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /home3/johnn315/apps/minha-api/bin/app .
/home3/johnn315/apps/minha-api/run.sh restart
/home3/johnn315/apps/minha-api/run.sh status
```

## 6) Executar comando remoto sem entrar no shell

```bash
ssh adhub-cpanel "cd /home3/johnn315/ad-hub.digital && git pull && /home3/johnn315/apps/minha-api/run.sh restart"
```

## 7) Segurança recomendada

- Nunca versione a chave privada.
- Use apenas a chave dedicada (`id_ed25519_adhub`).
- Se possível, desabilite login por senha no provedor (quando permitido).
- Revogue a chave imediatamente em caso de vazamento.

