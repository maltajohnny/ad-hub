-- AD-Hub: tokens OAuth Meta/TikTok por organização + cliente de mídia (alias).
-- MySQL / MariaDB 10.3+ (ex.: HostGator, cPanel).
-- Executar na base escolhida: mysql -u USER -p DBNAME < migrations/001_ad_platform_oauth_mysql.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS ad_platform_oauth_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  org_id VARCHAR(128) NOT NULL COMMENT 'ID da organização SaaS (string)',
  media_client_id CHAR(36) NOT NULL COMMENT 'UUID do cliente no módulo mídias/clientes',
  platform VARCHAR(32) NOT NULL COMMENT 'meta-ads | instagram-ads | tiktok-ads | google-ads',
  access_token MEDIUMTEXT NOT NULL,
  refresh_token MEDIUMTEXT NULL COMMENT 'ex.: TikTok refresh',
  token_expires_at DATETIME(6) NULL,
  external_account_id VARCHAR(128) NULL COMMENT 'act_xxx Meta ou advertiser_id TikTok',
  external_account_label VARCHAR(512) NULL,
  last_spend DECIMAL(18, 4) NULL,
  last_roi DECIMAL(18, 6) NULL,
  last_cpa DECIMAL(18, 4) NULL,
  last_currency VARCHAR(8) NULL DEFAULT 'USD',
  metrics_synced_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_client_platform (org_id, media_client_id, platform),
  KEY idx_org (org_id),
  KEY idx_media_client (media_client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
