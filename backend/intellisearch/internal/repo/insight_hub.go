package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"norter/intellisearch/internal/db"
)

// InsightHubEntitlement limits for an org.
type InsightHubEntitlement struct {
	Tier                 string
	Status               string
	MaxBrands            int
	MaxDashboards        int
	MaxGuestUsers        int
	MaxScheduledReports  int
	FeatureAI            bool
	FeatureCompetitor    bool
	FeatureGroupReports  bool
	FeatureClientPortal  bool
}

// InsightHubWorkspace row.
type InsightHubWorkspace struct {
	AgencyName *string
	PortalSlug *string
}

// InsightHubBrand list item.
type InsightHubBrand struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	Status    string  `json:"status"`
	LogoURL   *string `json:"logoUrl,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

// EnsureInsightHubTables cria tabelas mínimas se ainda não existirem (alinhado a database/mysql/006_insight_hub.sql + 007_insight_hub_analytics.sql).
func EnsureInsightHubTables(ctx context.Context, database *sql.DB) error {
	if database == nil {
		return errors.New("db nulo")
	}
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS insight_hub_entitlements (
  organization_id CHAR(36) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  status ENUM('trialing', 'active', 'past_due', 'cancelled') NOT NULL DEFAULT 'active',
  max_brands INT NOT NULL DEFAULT 5,
  max_dashboards INT NOT NULL DEFAULT 0,
  max_guest_users INT NOT NULL DEFAULT 0,
  max_scheduled_reports INT NOT NULL DEFAULT 0,
  feature_ai TINYINT(1) NOT NULL DEFAULT 0,
  feature_competitor TINYINT(1) NOT NULL DEFAULT 0,
  feature_group_reports TINYINT(1) NOT NULL DEFAULT 0,
  feature_client_portal TINYINT(1) NOT NULL DEFAULT 0,
  billing_period VARCHAR(16) NULL,
  current_period_end DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  CONSTRAINT fk_ih_ent_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_workspaces (
  organization_id CHAR(36) NOT NULL,
  agency_display_name VARCHAR(255) NULL,
  portal_slug VARCHAR(80) NULL,
  theme_json JSON NULL,
  onboarding_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  UNIQUE KEY uq_ih_workspace_portal_slug (portal_slug),
  CONSTRAINT fk_ih_ws_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_brands (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  logo_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  trial_ends_at DATETIME(3) NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ih_brands_org (organization_id),
  CONSTRAINT fk_ih_brand_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_connections (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_account_id VARCHAR(128) NULL,
  display_label VARCHAR(255) NULL,
  token_ref VARCHAR(128) NULL,
  scopes_json JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'connected',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_conn_brand_provider (brand_id, provider),
  KEY idx_ih_conn_org (organization_id),
  CONSTRAINT fk_ih_conn_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_conn_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_secrets (
  token_ref CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL,
  cipher_text MEDIUMBLOB NOT NULL,
  nonce VARBINARY(12) NOT NULL,
  algo VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_ref),
  KEY idx_ih_secret_org (organization_id),
  CONSTRAINT fk_ih_secret_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_secret_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_oauth_states (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_sync_state (
  connection_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'idle',
  last_cursor JSON NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_sync_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  connection_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_metrics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  connection_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_account_id VARCHAR(128) NULL,
  metric_date DATE NOT NULL,
  metric_key VARCHAR(96) NOT NULL,
  metric_value DECIMAL(20,4) NOT NULL DEFAULT 0,
  meta_json JSON NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_posts (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  connection_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_post_id VARCHAR(190) NOT NULL,
  external_account_id VARCHAR(128) NULL,
  permalink VARCHAR(1024) NULL,
  message LONGTEXT NULL,
  media_type VARCHAR(64) NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS insight_hub_kpi_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  range_label VARCHAR(32) NOT NULL,
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metrics_json JSON NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ih_kpi_brand_range (brand_id, range_label),
  KEY idx_ih_kpi_org_range (organization_id, range_label),
  CONSTRAINT fk_ih_kpi_org FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ih_kpi_brand FOREIGN KEY (brand_id) REFERENCES insight_hub_brands (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS billing_invoices (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  asaas_payment_id VARCHAR(64) NULL,
  asaas_subscription_id VARCHAR(64) NULL,
  description VARCHAR(255) NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range stmts {
		if _, err := database.ExecContext(ctx, q); err != nil {
			return err
		}
	}
	return nil
}

// GetInsightHubEntitlement lê subscrição do módulo; sql.ErrNoRows = sem subscrição.
func GetInsightHubEntitlement(ctx context.Context, orgID string) (*InsightHubEntitlement, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" {
		return nil, errors.New("org em falta")
	}
	var e InsightHubEntitlement
	var fa, fc, fg, fcp int
	err := db.DB.QueryRowContext(ctx, `
SELECT tier, status, max_brands, max_dashboards, max_guest_users, max_scheduled_reports,
       feature_ai, feature_competitor, feature_group_reports, feature_client_portal
FROM insight_hub_entitlements WHERE organization_id = ?`, oid,
	).Scan(
		&e.Tier, &e.Status, &e.MaxBrands, &e.MaxDashboards, &e.MaxGuestUsers, &e.MaxScheduledReports,
		&fa, &fc, &fg, &fcp,
	)
	if err != nil {
		return nil, err
	}
	e.FeatureAI = fa != 0
	e.FeatureCompetitor = fc != 0
	e.FeatureGroupReports = fg != 0
	e.FeatureClientPortal = fcp != 0
	return &e, nil
}

// EnsureInsightHubWorkspace insere linha de workspace se ainda não existir.
func EnsureInsightHubWorkspace(ctx context.Context, orgID string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" {
		return errors.New("org em falta")
	}
	_, err := db.DB.ExecContext(ctx, `
INSERT IGNORE INTO insight_hub_workspaces (organization_id, created_at, updated_at)
VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, oid)
	return err
}

// GetInsightHubWorkspace devolve dados do workspace ou nil se não existir.
func GetInsightHubWorkspace(ctx context.Context, orgID string) (*InsightHubWorkspace, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	var agency, slug sql.NullString
	err := db.DB.QueryRowContext(ctx,
		`SELECT agency_display_name, portal_slug FROM insight_hub_workspaces WHERE organization_id = ?`, oid,
	).Scan(&agency, &slug)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w := &InsightHubWorkspace{}
	if agency.Valid {
		s := agency.String
		w.AgencyName = &s
	}
	if slug.Valid {
		s := slug.String
		w.PortalSlug = &s
	}
	return w, nil
}

// CountInsightHubBrands conta marcas ativas/trial da organização.
func CountInsightHubBrands(ctx context.Context, orgID string) (int, error) {
	if db.DB == nil {
		return 0, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	var n int
	err := db.DB.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM insight_hub_brands WHERE organization_id = ? AND status IN ('active','trial')`, oid,
	).Scan(&n)
	return n, err
}

// ListInsightHubBrands lista marcas da organização.
func ListInsightHubBrands(ctx context.Context, orgID string) ([]InsightHubBrand, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	rows, err := db.DB.QueryContext(ctx, `
SELECT id, name, COALESCE(email,''), status, logo_url,
       DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ')
FROM insight_hub_brands WHERE organization_id = ? ORDER BY name ASC`, oid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InsightHubBrand
	for rows.Next() {
		var b InsightHubBrand
		var logo sql.NullString
		if err := rows.Scan(&b.ID, &b.Name, &b.Email, &b.Status, &logo, &b.CreatedAt); err != nil {
			return nil, err
		}
		if logo.Valid {
			s := logo.String
			b.LogoURL = &s
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// InsertInsightHubBrand cria marca se abaixo do limite.
func InsertInsightHubBrand(ctx context.Context, orgID, id, name, email string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	n := strings.TrimSpace(name)
	if oid == "" || id == "" || n == "" {
		return errors.New("dados em falta")
	}
	ent, err := GetInsightHubEntitlement(ctx, oid)
	if err != nil {
		return err
	}
	if !insightHubEntitlementActive(ent.Status) {
		return errors.New("subscrição inativa")
	}
	cnt, err := CountInsightHubBrands(ctx, oid)
	if err != nil {
		return err
	}
	maxB := ent.MaxBrands
	if maxB >= 0 && cnt >= maxB {
		return errors.New("limite de marcas atingido para o plano")
	}
	_, err = db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_brands (id, organization_id, name, email, status, created_at, updated_at)
VALUES (?, ?, ?, NULLIF(?,''), 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, oid, n, strings.TrimSpace(email))
	return err
}

func insightHubEntitlementActive(status string) bool {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case "trialing", "active":
		return true
	default:
		return false
	}
}

// InsightHubEntitlementActive exportado para handlers.
func InsightHubEntitlementActive(status string) bool {
	return insightHubEntitlementActive(status)
}
