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

// EnsureInsightHubTables cria tabelas mínimas se ainda não existirem (alinhado a database/mysql/006_insight_hub.sql).
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
