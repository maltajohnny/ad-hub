-- Igual a database/mysql/003_organization_billing.sql — aplicar na mesma BD que MYSQL_DSN.
SET NAMES utf8mb4;

ALTER TABLE organizations
  ADD COLUMN plan_slug VARCHAR(32) NULL COMMENT 'gestor | organizacao | scale' AFTER enabled_modules,
  ADD COLUMN billing_period VARCHAR(16) NULL COMMENT 'monthly | yearly' AFTER plan_slug,
  ADD COLUMN subscription_status VARCHAR(24) NOT NULL DEFAULT 'none' AFTER billing_period,
  ADD COLUMN asaas_customer_id VARCHAR(64) NULL AFTER subscription_status,
  ADD COLUMN asaas_subscription_updated_at DATETIME(3) NULL AFTER asaas_customer_id;

CREATE TABLE IF NOT EXISTS asaas_webhook_events (
  asaas_event_id VARCHAR(160) NOT NULL PRIMARY KEY,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
