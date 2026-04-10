-- AD-Hub: tokens OAuth Meta/TikTok (PostgreSQL 14+).
-- psql -U USER -d DBNAME -f migrations/001_ad_platform_oauth_postgres.sql

BEGIN;

CREATE TABLE IF NOT EXISTS ad_platform_oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  org_id VARCHAR(128) NOT NULL,
  media_client_id UUID NOT NULL,
  platform VARCHAR(32) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,
  external_account_id VARCHAR(128) NULL,
  external_account_label VARCHAR(512) NULL,
  last_spend NUMERIC(18, 4) NULL,
  last_roi NUMERIC(18, 6) NULL,
  last_cpa NUMERIC(18, 4) NULL,
  last_currency VARCHAR(8) NULL DEFAULT 'USD',
  metrics_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_client_platform UNIQUE (org_id, media_client_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_ad_platform_tokens_org ON ad_platform_oauth_tokens (org_id);
CREATE INDEX IF NOT EXISTS idx_ad_platform_tokens_client ON ad_platform_oauth_tokens (media_client_id);

COMMIT;
