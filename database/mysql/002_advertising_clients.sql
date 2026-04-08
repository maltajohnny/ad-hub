-- Clientes de anúncios (módulo Clientes + integrações Meta / Instagram / Google / TikTok).
-- Pré-requisito: executar antes `001_adhub_core.sql` (tabela `organizations`).
-- Fluxo de produto: cadastro com nome (e org); email, segmento, CNPJ e métricas vêm da sincronização com as APIs.
-- Espelha `Client` em src/pages/Clientes.tsx e `MediaClient` em src/lib/mediaManagementStore.ts.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS advertising_clients (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  display_name VARCHAR(255) NOT NULL COMMENT 'Nome no cadastro (obrigatório no fluxo atual)',
  segment VARCHAR(128) NULL COMMENT 'Pode ser preenchido manualmente ou inferido/sincronizado',
  email VARCHAR(255) NULL,
  tax_id VARCHAR(32) NULL COMMENT 'CNPJ ou equivalente',
  status ENUM('ativo', 'pausado') NOT NULL DEFAULT 'ativo',
  budget_label VARCHAR(128) NULL COMMENT 'Ex.: R$ 20.000/mês',
  ai_insight_last TEXT NULL COMMENT 'Último insight exibido no cartão (pode vir da IA)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_adv_clients_org (organization_id),
  CONSTRAINT fk_adv_clients_org
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ligação OAuth / estado de sync por plataforma (ids alinhados a MEDIA_PLATFORMS no frontend).
CREATE TABLE IF NOT EXISTS advertising_client_platform_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id CHAR(36) NOT NULL,
  platform VARCHAR(32) NOT NULL COMMENT 'meta-ads | instagram-ads | google-ads | tiktok-ads',
  status VARCHAR(32) NOT NULL DEFAULT 'not-connected' COMMENT 'not-connected | connected | expired | error | syncing',
  external_account_id VARCHAR(128) NULL,
  external_account_label VARCHAR(255) NULL,
  oauth_refresh_token_encrypted VARBINARY(4096) NULL,
  connected_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_sync_at DATETIME(3) NULL,
  last_error TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_platform (client_id, platform),
  CONSTRAINT fk_adv_plat_client
    FOREIGN KEY (client_id) REFERENCES advertising_clients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contas de anúncio escolhidas após OAuth (várias por plataforma).
CREATE TABLE IF NOT EXISTS advertising_client_selected_ad_accounts (
  client_id CHAR(36) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  external_ad_account_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (client_id, platform, external_ad_account_id),
  CONSTRAINT fk_adv_sel_client
    FOREIGN KEY (client_id) REFERENCES advertising_clients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Último snapshot agregado para lista / cartão (espelha campos principais de Client).
CREATE TABLE IF NOT EXISTS advertising_client_metrics_latest (
  client_id CHAR(36) NOT NULL,
  spend_numeric DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  spend_display VARCHAR(32) NULL COMMENT 'Ex.: R$ 18.500',
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  roi_display VARCHAR(16) NULL COMMENT 'Ex.: 4.2x',
  leads INT UNSIGNED NOT NULL DEFAULT 0,
  conversions INT UNSIGNED NOT NULL DEFAULT 0,
  leads_change_pct DECIMAL(6, 2) NULL,
  conv_change_pct DECIMAL(6, 2) NULL,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cpa DECIMAL(12, 4) NULL,
  cpc DECIMAL(12, 4) NULL,
  cpm DECIMAL(12, 4) NULL,
  ctr DECIMAL(8, 4) NULL,
  platforms_json JSON NULL COMMENT 'Array de labels ex.: ["Meta","Google"]',
  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (client_id),
  CONSTRAINT fk_adv_metrics_client
    FOREIGN KEY (client_id) REFERENCES advertising_clients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Métricas por canal (espelha RoiTableRow / séries por rede).
CREATE TABLE IF NOT EXISTS advertising_client_channel_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id CHAR(36) NOT NULL,
  channel VARCHAR(32) NOT NULL COMMENT 'meta_ads | google_ads | instagram_ads',
  period_start DATE NULL,
  period_end DATE NULL,
  invested DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  leads INT UNSIGNED NOT NULL DEFAULT 0,
  conversions INT UNSIGNED NOT NULL DEFAULT 0,
  revenue DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  cpl DECIMAL(12, 4) NULL,
  roi_mult DECIMAL(8, 4) NULL,
  captured_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_adv_ch_client (client_id, channel, captured_at),
  CONSTRAINT fk_adv_ch_client
    FOREIGN KEY (client_id) REFERENCES advertising_clients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_advertising_clients');
