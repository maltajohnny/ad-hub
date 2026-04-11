-- Recuperação de senha (token único + expiração)
-- Executar no mesmo schema que 001_adhub_core (phpMyAdmin ou CLI).

ALTER TABLE users
  ADD COLUMN password_reset_token VARCHAR(128) NULL DEFAULT NULL COMMENT 'Token opaco; único quando definido' AFTER password_hash,
  ADD COLUMN password_reset_expires_at DATETIME(3) NULL DEFAULT NULL AFTER password_reset_token;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_password_reset_token (password_reset_token);

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_password_reset');
