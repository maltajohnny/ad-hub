-- Lugares de equipa no plano Gestor (0–3) — executar após 003_organization_billing.
SET NAMES utf8mb4;

ALTER TABLE organizations
  ADD COLUMN gestor_team_seats TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Utilizadores extra incluídos no plano Gestor (módulo Usuários)' AFTER asaas_subscription_updated_at;

INSERT IGNORE INTO schema_migrations (version) VALUES ('004_gestor_team_seats');
