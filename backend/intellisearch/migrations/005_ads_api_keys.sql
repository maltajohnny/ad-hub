-- Configuração central de credenciais de módulos (Usuários -> Módulos)
-- Aplicar na mesma base do MYSQL_DSN:
-- mysql -u USER -p DBNAME < migrations/005_ads_api_keys.sql

CREATE TABLE IF NOT EXISTS ads_api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope ENUM('platform') NOT NULL DEFAULT 'platform',
  scope_id VARCHAR(64) NOT NULL DEFAULT 'global',

  meta_app_id VARCHAR(255) NULL,
  meta_app_secret TEXT NULL,
  instagram_graph_api_token TEXT NULL,
  meta_ads_library_token TEXT NULL,

  tiktok_app_id VARCHAR(255) NULL,
  tiktok_client_key VARCHAR(255) NULL,
  tiktok_app_secret TEXT NULL,

  google_oauth_client_id VARCHAR(255) NULL,
  google_oauth_client_secret TEXT NULL,
  google_places_api_key TEXT NULL,

  serpapi_key TEXT NULL,
  dataforseo_login VARCHAR(255) NULL,
  dataforseo_password TEXT NULL,

  hunter_api_key TEXT NULL,

  sendgrid_api_key TEXT NULL,
  twilio_account_sid VARCHAR(255) NULL,
  twilio_auth_token TEXT NULL,
  whatsapp_meta_access_token TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ads_api_keys_scope (scope, scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

