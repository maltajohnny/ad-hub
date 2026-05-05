-- AD-Hub — Insight Hub · tabelas analíticas (séries, posts, KPIs e jobs).
-- Multi-tenant: tudo amarrado a organizations.id e (quando aplicável) brand_id/connection_id.
-- Execute depois de 006_insight_hub.sql.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Estado de sincronização por conexão (rate-limit, último cursor, próxima execução).
CREATE TABLE IF NOT EXISTS insight_hub_sync_state (
  connection_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'idle' COMMENT 'idle | running | error | rate_limited',
  last_cursor JSON NULL COMMENT 'cursor por endpoint Meta (ex.: paginação since/until)',
  last_synced_at DATETIME(3) NULL,
  next_run_at DATETIME(3) NULL,
  failure_count INT NOT NULL DEFAULT 0,
  last_error VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (connection_id),
  KEY idx_ih_sync_state_org (organization_id),
  KEY idx_ih_sync_state_next (next_run_at),
  CONSTRAINT fk_ih_sync_state_conn FOREIGN KEY (connection_id) REFERENCES insight_hub_connections (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_sync_state_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_sync_state_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log de execuções (auditoria + diagnóstico).
CREATE TABLE IF NOT EXISTS insight_hub_sync_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  connection_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running' COMMENT 'running | success | error',
  rows_ingested INT NOT NULL DEFAULT 0,
  http_calls INT NOT NULL DEFAULT 0,
  error_message VARCHAR(1024) NULL,
  PRIMARY KEY (id),
  KEY idx_ih_sync_runs_conn (connection_id, started_at),
  KEY idx_ih_sync_runs_org (organization_id, started_at),
  CONSTRAINT fk_ih_sync_runs_conn FOREIGN KEY (connection_id) REFERENCES insight_hub_connections (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_sync_runs_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Métricas diárias por conexão / nível (page, account, ad_account...).
-- Granularidade dia para suportar agregações por semana/mês sem reprocessar API.
CREATE TABLE IF NOT EXISTS insight_hub_metrics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  connection_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_account_id VARCHAR(128) NULL,
  metric_date DATE NOT NULL,
  metric_key VARCHAR(96) NOT NULL COMMENT 'ex.: page_impressions, reach, spend, ctr, follower_count',
  metric_value DECIMAL(20,4) NOT NULL DEFAULT 0,
  meta_json JSON NULL COMMENT 'campos opcionais (segmentos, breakdown, currency)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_metric_day (connection_id, metric_date, metric_key),
  KEY idx_ih_metric_brand_date (brand_id, metric_date),
  KEY idx_ih_metric_org_date (organization_id, metric_date),
  CONSTRAINT fk_ih_metric_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_metric_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_metric_conn FOREIGN KEY (connection_id) REFERENCES insight_hub_connections (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Posts/itens de conteúdo persistidos para feed analítico (post-level insights).
CREATE TABLE IF NOT EXISTS insight_hub_posts (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  connection_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_post_id VARCHAR(190) NOT NULL,
  external_account_id VARCHAR(128) NULL,
  permalink VARCHAR(1024) NULL,
  message LONGTEXT NULL,
  media_type VARCHAR(64) NULL COMMENT 'photo | video | reel | carousel | story | text',
  media_url VARCHAR(1024) NULL,
  thumbnail_url VARCHAR(1024) NULL,
  published_at DATETIME(3) NULL,
  reach INT NULL,
  impressions INT NULL,
  likes INT NULL,
  comments INT NULL,
  shares INT NULL,
  saves INT NULL,
  video_views INT NULL,
  engagement INT NULL,
  raw_json JSON NULL,
  fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_post_provider_id (connection_id, external_post_id),
  KEY idx_ih_post_brand_published (brand_id, published_at),
  KEY idx_ih_post_org_published (organization_id, published_at),
  CONSTRAINT fk_ih_post_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_post_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_post_conn FOREIGN KEY (connection_id) REFERENCES insight_hub_connections (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KPIs agregados (cache para overview rápido — recalculado pelo scheduler).
CREATE TABLE IF NOT EXISTS insight_hub_kpi_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  range_label VARCHAR(32) NOT NULL COMMENT '7d | 14d | 30d | 90d | mtd | ytd',
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metrics_json JSON NOT NULL COMMENT 'Conjunto consolidado de KPIs prontos para a UI',
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_kpi_brand_range (brand_id, range_label),
  KEY idx_ih_kpi_org_range (organization_id, range_label),
  CONSTRAINT fk_ih_kpi_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_kpi_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens externos cifrados — referenciados por insight_hub_connections.token_ref.
-- Mantemos um vault dedicado para limpar fácil (DELETE) ou rotação por aud./scope.
CREATE TABLE IF NOT EXISTS insight_hub_secrets (
  token_ref CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL,
  cipher_text MEDIUMBLOB NOT NULL COMMENT 'AES-GCM(payload JSON) — chave em ADHUB_INSIGHT_HUB_SECRET_KEY',
  nonce VARBINARY(12) NOT NULL,
  algo VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',
  expires_at DATETIME(3) NULL COMMENT 'expiração informada pelo provedor (best-effort)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_ref),
  KEY idx_ih_secret_org (organization_id),
  CONSTRAINT fk_ih_secret_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_secret_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Estado OAuth — anti-CSRF do fluxo de autorização (associa state ao org/brand).
CREATE TABLE IF NOT EXISTS insight_hub_oauth_states (
  state CHAR(64) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  return_path VARCHAR(512) NULL,
  redirect_uri VARCHAR(512) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (state),
  KEY idx_ih_oauth_state_org (organization_id),
  CONSTRAINT fk_ih_oauth_state_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_oauth_state_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Faturas / cobranças sincronizadas do Asaas (Meu Plano e Insight Hub).
CREATE TABLE IF NOT EXISTS billing_invoices (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  asaas_payment_id VARCHAR(64) NULL,
  asaas_subscription_id VARCHAR(64) NULL,
  description VARCHAR(255) NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
  status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending | paid | overdue | cancelled | refunded',
  due_at DATETIME(3) NULL,
  paid_at DATETIME(3) NULL,
  invoice_url VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_asaas_payment (asaas_payment_id),
  KEY idx_invoice_org_status (organization_id, status),
  KEY idx_invoice_due (due_at),
  CONSTRAINT fk_invoice_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('007_insight_hub_analytics');
