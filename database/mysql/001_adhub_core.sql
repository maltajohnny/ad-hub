-- AD-Hub — esquema base MySQL 8+ / MariaDB 10.3+ (utf8mb4)
--
-- ANTES DE EXECUTAR:
-- 1. No cPanel crie o banco (ex.: johnn315_db-adhub-prd) e um utilizador MySQL com TODOS os privilégios nesse banco.
-- 2. No phpMyAdmin: selecione esse banco → separador SQL → cole este ficheiro → Executar.
--    (Nomes com hífen precisam de aspas: `johnn315_db-adhub-prd`.)
--
-- Não inclui CREATE DATABASE — em hosting partilhado o banco já vem criado pelo cPanel.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  logo_data_url LONGTEXT NULL,
  browser_tab_title VARCHAR(255) NULL,
  favicon_data_url LONGTEXT NULL,
  accent_hex VARCHAR(16) NULL,
  enabled_modules JSON NULL COMMENT 'Array JSON de slugs de módulo; null ou [] = todos',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NULL,
  username VARCHAR(190) NOT NULL COMMENT 'Chave de login normalizada pela app',
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  document VARCHAR(64) NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt ou argon2; nunca texto simples',
  avatar_data_url LONGTEXT NULL,
  can_manage_board TINYINT(1) NOT NULL DEFAULT 0,
  can_delete_board_cards TINYINT(1) NOT NULL DEFAULT 0,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  allowed_modules JSON NULL COMMENT 'Array JSON de módulos; null = todos permitidos pela org',
  disabled TINYINT(1) NOT NULL DEFAULT 0,
  hide_from_platform_list TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_org (organization_id),
  KEY idx_users_email (email),
  CONSTRAINT fk_users_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex do refresh token',
  user_agent VARCHAR(512) NULL,
  ip_varbinary VARBINARY(16) NULL COMMENT 'IPv4 4 bytes ou IPv16 16 bytes',
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_hash (refresh_token_hash),
  KEY idx_user_sessions_user (user_id),
  KEY idx_user_sessions_expires (expires_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NULL,
  actor_username VARCHAR(190) NULL,
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id VARCHAR(64) NULL,
  detail JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_org (organization_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_adhub_core');

-- Organizações built-in (alinhadas com tenantsStore.ts). Sem passwords aqui.
INSERT IGNORE INTO organizations (id, slug, display_name, logo_data_url, enabled_modules, browser_tab_title)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'norter', 'Norter', NULL, JSON_ARRAY(), NULL),
  ('00000000-0000-4000-8000-000000000002', 'qtraffic', 'AD-Hub', NULL, JSON_ARRAY(), 'AD-Hub — Move faster · Grow smarter');

-- Conta admin inicial: SUBSTITUA o hash por um bcrypt real (ex.: gerado na app) antes de usar em produção.
-- Exemplo de placeholder inválido — força troca após implementar login na API:
-- INSERT IGNORE INTO users (id, organization_id, username, role, name, email, password_hash, must_change_password)
-- VALUES (UUID(), NULL, 'admin', 'admin', 'Administrador', 'admin@example.com', '$2a$10$REPLACE_WITH_BCRYPT_HASH', 1);
