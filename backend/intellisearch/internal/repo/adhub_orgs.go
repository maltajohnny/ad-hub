package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"norter/intellisearch/internal/db"

	"github.com/google/uuid"
)

// OrganizationRow dados mínimos para resposta ao cliente.
type OrganizationRow struct {
	ID          string
	Slug        string
	DisplayName string
}

// OrgSubscriptionBilling estado de faturação / plano (API dashboard).
type OrgSubscriptionBilling struct {
	PlanSlug             sql.NullString
	BillingPeriod        sql.NullString
	SubscriptionStatus   string
	GestorTeamSeats      int
	AsaasCustomerID      sql.NullString
	AsaasUpdatedAt       sql.NullTime
}

// InsertOrganization cria linha em organizations.
func InsertOrganization(ctx context.Context, id, slug, displayName string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	slug = strings.TrimSpace(strings.ToLower(slug))
	dn := strings.TrimSpace(displayName)
	if id == "" || slug == "" || dn == "" {
		return errors.New("dados em falta")
	}
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO organizations (id, slug, display_name, logo_data_url, enabled_modules, created_at, updated_at)
VALUES (?, ?, ?, NULL, NULL, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, slug, dn)
	return err
}

// SlugExists devolve true se o slug já está em uso.
func SlugExists(ctx context.Context, slug string) (bool, error) {
	if db.DB == nil {
		return false, errors.New("mysql indisponível")
	}
	s := strings.TrimSpace(strings.ToLower(slug))
	var n int
	err := db.DB.QueryRowContext(ctx, `SELECT COUNT(1) FROM organizations WHERE slug = ?`, s).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// GetOrganizationByID lê slug e nome.
func GetOrganizationByID(ctx context.Context, id string) (*OrganizationRow, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	var r OrganizationRow
	err := db.DB.QueryRowContext(ctx,
		`SELECT id, slug, display_name FROM organizations WHERE id = ?`, strings.TrimSpace(id),
	).Scan(&r.ID, &r.Slug, &r.DisplayName)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// GetOrgSubscriptionBilling lê plano e extras para o dashboard.
func GetOrgSubscriptionBilling(ctx context.Context, orgID string) (*OrgSubscriptionBilling, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" {
		return nil, errors.New("org em falta")
	}
	var o OrgSubscriptionBilling
	err := db.DB.QueryRowContext(ctx, `
SELECT plan_slug, billing_period, subscription_status, gestor_team_seats, asaas_customer_id, asaas_subscription_updated_at
FROM organizations WHERE id = ?`, oid,
	).Scan(&o.PlanSlug, &o.BillingPeriod, &o.SubscriptionStatus, &o.GestorTeamSeats, &o.AsaasCustomerID, &o.AsaasUpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// UpdateOrgSubscriptionBilling atualiza plano e estado após pagamento confirmado (webhook) ou checkout pendente.
// gestorTeamSeats < 0 = não alterar a coluna.
func UpdateOrgSubscriptionBilling(ctx context.Context, orgID, planSlug, billingPeriod, status, asaasCustomerID string, gestorTeamSeats int) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" {
		return errors.New("org em falta")
	}
	if gestorTeamSeats >= 0 {
		_, err := db.DB.ExecContext(ctx, `
UPDATE organizations SET
  plan_slug = ?,
  billing_period = ?,
  subscription_status = ?,
  asaas_customer_id = COALESCE(?, asaas_customer_id),
  gestor_team_seats = ?,
  asaas_subscription_updated_at = UTC_TIMESTAMP(3),
  updated_at = UTC_TIMESTAMP(3)
WHERE id = ?`,
			nullIfEmpty(planSlug),
			nullIfEmpty(billingPeriod),
			strings.TrimSpace(status),
			nullIfEmpty(asaasCustomerID),
			gestorTeamSeats,
			oid,
		)
		return err
	}
	_, err := db.DB.ExecContext(ctx, `
UPDATE organizations SET
  plan_slug = ?,
  billing_period = ?,
  subscription_status = ?,
  asaas_customer_id = COALESCE(?, asaas_customer_id),
  asaas_subscription_updated_at = UTC_TIMESTAMP(3),
  updated_at = UTC_TIMESTAMP(3)
WHERE id = ?`,
		nullIfEmpty(planSlug),
		nullIfEmpty(billingPeriod),
		strings.TrimSpace(status),
		nullIfEmpty(asaasCustomerID),
		oid,
	)
	return err
}

func nullIfEmpty(s string) interface{} {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return s
}

// InsertWebhookEventIdempotency regista id do evento Asaas; false se já existia (duplicado).
func InsertWebhookEventIdempotency(ctx context.Context, eventID string) (inserted bool, err error) {
	if db.DB == nil {
		return false, errors.New("mysql indisponível")
	}
	eid := strings.TrimSpace(eventID)
	if eid == "" {
		return false, errors.New("event id vazio")
	}
	res, err := db.DB.ExecContext(ctx,
		`INSERT IGNORE INTO asaas_webhook_events (asaas_event_id) VALUES (?)`, eid)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// NewUUID gera id tipo CHAR(36).
func NewUUID() string {
	return uuid.New().String()
}

