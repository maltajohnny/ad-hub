-- AD-Hub — Insight Hub (analytics / relatórios estilo mLabs·Reportei)
-- Multi-tenant: cada linha está ligada a organizations.id; nenhum utilizador cruza organizações na API.
-- Execute no mesmo schema que 001_adhub_core.sql (depois de organizations existir).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Direitos do módulo por organização (criado quando o cliente compra / ativa o add-on).
CREATE TABLE IF NOT EXISTS insight_hub_entitlements (
  organization_id CHAR(36) NOT NULL,
  tier VARCHAR(32) NOT NULL COMMENT 'essencial | crescimento | premium',
  status ENUM('trialing', 'active', 'past_due', 'cancelled') NOT NULL DEFAULT 'active',
  max_brands INT NOT NULL DEFAULT 5,
  max_dashboards INT NOT NULL DEFAULT 0 COMMENT '-1 = ilimitado ou 1 por marca conforme produto',
  max_guest_users INT NOT NULL DEFAULT 0 COMMENT '-1 = ilimitado',
  max_scheduled_reports INT NOT NULL DEFAULT 0 COMMENT '-1 = ilimitado',
  feature_ai TINYINT(1) NOT NULL DEFAULT 0,
  feature_competitor TINYINT(1) NOT NULL DEFAULT 0,
  feature_group_reports TINYINT(1) NOT NULL DEFAULT 0,
  feature_client_portal TINYINT(1) NOT NULL DEFAULT 0,
  billing_period VARCHAR(16) NULL COMMENT 'monthly | yearly',
  current_period_end DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  CONSTRAINT fk_ih_ent_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Área de trabalho white-label / portal (uma por organização com módulo ativo).
CREATE TABLE IF NOT EXISTS insight_hub_workspaces (
  organization_id CHAR(36) NOT NULL,
  agency_display_name VARCHAR(255) NULL,
  portal_slug VARCHAR(80) NULL COMMENT 'subpath público único, ex.: minha-agencia',
  theme_json JSON NULL COMMENT 'cores, logo URL, etc.',
  onboarding_json JSON NULL COMMENT 'passos concluídos, objetivos',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  UNIQUE KEY uq_ih_workspace_portal_slug (portal_slug),
  CONSTRAINT fk_ih_ws_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marcas / clientes finais do gestor (equivalente a “Marca” na mLabs).
CREATE TABLE IF NOT EXISTS insight_hub_brands (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  logo_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT 'active | trial | archived',
  trial_ends_at DATETIME(3) NULL,
  meta_json JSON NULL COMMENT 'notas, segmento, etc.',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_brands_org (organization_id),
  CONSTRAINT fk_ih_brand_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ligações OAuth / tokens por marca e fornecedor (sem guardar segredo em texto claro — usar vault ou encriptação na app).
CREATE TABLE IF NOT EXISTS insight_hub_connections (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL COMMENT 'meta_ads | facebook_insights | instagram | google_ads | ga4 | ...',
  external_account_id VARCHAR(128) NULL,
  display_label VARCHAR(255) NULL,
  token_ref VARCHAR(128) NULL COMMENT 'referência a segredo fora da BD ou blob encriptado',
  scopes_json JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'connected' COMMENT 'connected | expired | revoked',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_conn_brand_provider (brand_id, provider),
  KEY idx_ih_conn_org (organization_id),
  CONSTRAINT fk_ih_conn_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_conn_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Definição de relatório (layouts + widgets em JSON — drag-and-drop futuro).
CREATE TABLE IF NOT EXISTS insight_hub_reports (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL COMMENT 'null = relatório agregado / template',
  title VARCHAR(255) NOT NULL,
  definition_json JSON NOT NULL,
  template_key VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_reports_org (organization_id),
  KEY idx_ih_reports_brand (brand_id),
  CONSTRAINT fk_ih_rep_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_rep_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insight_hub_dashboards (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  definition_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_dash_org (organization_id),
  KEY idx_ih_dash_brand (brand_id),
  CONSTRAINT fk_ih_dash_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_dash_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insight_hub_scheduled_reports (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  report_id CHAR(36) NULL,
  cron_expr VARCHAR(64) NOT NULL COMMENT 'expressão ou etiqueta fixa para job runner',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  recipients_json JSON NOT NULL COMMENT 'lista de e-mails',
  next_run_at DATETIME(3) NULL,
  last_run_at DATETIME(3) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_sched_org (organization_id),
  CONSTRAINT fk_ih_sched_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_sched_report FOREIGN KEY (report_id) REFERENCES insight_hub_reports (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Utilizadores convidados (acesso só leitura ao portal / relatórios).
CREATE TABLE IF NOT EXISTS insight_hub_guest_users (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'viewer',
  invited_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  accepted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_guest_org_email (organization_id, email),
  CONSTRAINT fk_ih_guest_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insight_hub_brand_groups (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_grp_org (organization_id),
  CONSTRAINT fk_ih_grp_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insight_hub_brand_group_members (
  group_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  PRIMARY KEY (group_id, brand_id),
  CONSTRAINT fk_ih_bgm_group FOREIGN KEY (group_id) REFERENCES insight_hub_brand_groups (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_bgm_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('006_insight_hub');

-- --- Ativação manual de exemplo (substitua ORG_ID por UUID da organizations):
-- INSERT INTO insight_hub_entitlements (organization_id, tier, status, max_brands, max_dashboards, max_guest_users, max_scheduled_reports, feature_ai, feature_competitor, feature_group_reports, feature_client_portal)
-- VALUES ('ORG_ID', 'premium', 'active', 30, -1, -1, -1, 1, 1, 1, 1);
-- Atualize também enabled_modules na organização para incluir "insight-hub" no JSON, ou deixe NULL = todos os módulos.
