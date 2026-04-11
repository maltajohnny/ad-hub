# Redefinir senha manualmente (MySQL)

Útil quando não há e-mail SMTP ou precisa de acesso de emergência ao utilizador `admin`.

## 1) Gerar hash bcrypt (não guarde a senha em texto na base)

Na pasta `backend/intellisearch`:

```bash
go run ./cmd/hashpassword 'SuaNovaSenhaForte!A1'
```

Copie a linha que começa por `$2a$...`.

## 2) Atualizar na base (phpMyAdmin ou cliente SQL)

Substitua `AQUI_O_HASH` pelo output do comando acima.

```sql
UPDATE users
SET password_hash = 'AQUI_O_HASH',
    must_change_password = 0,
    password_reset_token = NULL,
    password_reset_expires_at = NULL,
    updated_at = UTC_TIMESTAMP(3)
WHERE username = 'admin';
```

## 3) Senhas com `$` no `.env` (MySQL DSN / variáveis)

Em ficheiros `.env`, um `$` pode ser interpretado pela shell ou por parsers. Coloque a senha entre aspas simples ou escape o `$` conforme o ambiente.

## 4) Migração de recuperação por e-mail

Para `POST /api/ad-hub/auth/forgot-password` gravar tokens, execute no mesmo schema:

`backend/intellisearch/migrations/003_password_reset.sql`
