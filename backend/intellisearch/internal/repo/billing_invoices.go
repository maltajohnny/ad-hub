package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// BillingInvoiceRow item para listagem da org.
type BillingInvoiceRow struct {
	ID          string  `json:"id"`
	Description string  `json:"description,omitempty"`
	AmountCents int     `json:"amountCents"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
	DueAt       *string `json:"dueAt,omitempty"`
	PaidAt      *string `json:"paidAt,omitempty"`
	InvoiceURL  string  `json:"invoiceUrl,omitempty"`
	CreatedAt   string  `json:"createdAt"`
}

// UpsertBillingInvoice cria ou atualiza fatura via asaas_payment_id (idempotente).
func UpsertBillingInvoice(
	ctx context.Context, orgID, paymentID, subscriptionID, description string,
	amountCents int, currency, status string, dueAt, paidAt *time.Time, invoiceURL string,
) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	if currency == "" {
		currency = "BRL"
	}
	pid := strings.TrimSpace(paymentID)
	if pid != "" {
		var existing string
		_ = db.DB.QueryRowContext(ctx,
			`SELECT id FROM billing_invoices WHERE asaas_payment_id = ? AND organization_id = ?`,
			pid, strings.TrimSpace(orgID),
		).Scan(&existing)
		if existing != "" {
			_, err := db.DB.ExecContext(ctx, `
UPDATE billing_invoices SET
  asaas_subscription_id = NULLIF(?, ''),
  description = ?,
  amount_cents = ?,
  currency = ?,
  status = ?,
  due_at = ?, paid_at = ?, invoice_url = NULLIF(?, ''),
  updated_at = UTC_TIMESTAMP(3)
WHERE id = ?`,
				strings.TrimSpace(subscriptionID), description, amountCents, currency, strings.TrimSpace(status),
				timeOrNil(dueAt), timeOrNil(paidAt), strings.TrimSpace(invoiceURL), existing,
			)
			return existing, err
		}
	}
	id := NewUUID()
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO billing_invoices (id, organization_id, asaas_payment_id, asaas_subscription_id, description, amount_cents, currency, status, due_at, paid_at, invoice_url, created_at, updated_at)
VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, ?, ?, NULLIF(?, ''), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, strings.TrimSpace(orgID), pid, strings.TrimSpace(subscriptionID), description, amountCents, currency,
		strings.TrimSpace(status), timeOrNil(dueAt), timeOrNil(paidAt), strings.TrimSpace(invoiceURL),
	)
	return id, err
}

// ListBillingInvoices devolve faturas mais recentes.
func ListBillingInvoices(ctx context.Context, orgID string, limit int) ([]BillingInvoiceRow, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := db.DB.QueryContext(ctx, `
SELECT id, COALESCE(description, ''), amount_cents, currency, status,
       DATE_FORMAT(due_at, '%Y-%m-%dT%H:%i:%sZ'),
       DATE_FORMAT(paid_at, '%Y-%m-%dT%H:%i:%sZ'),
       COALESCE(invoice_url, ''),
       DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ')
FROM billing_invoices WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
		strings.TrimSpace(orgID), limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BillingInvoiceRow
	for rows.Next() {
		var r BillingInvoiceRow
		var due, paid sql.NullString
		if err := rows.Scan(&r.ID, &r.Description, &r.AmountCents, &r.Currency, &r.Status,
			&due, &paid, &r.InvoiceURL, &r.CreatedAt); err != nil {
			return nil, err
		}
		if due.Valid {
			s := due.String
			r.DueAt = &s
		}
		if paid.Valid {
			s := paid.String
			r.PaidAt = &s
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CountPendingInvoices devolve número de faturas em pending/overdue (para Meu Plano).
func CountPendingInvoices(ctx context.Context, orgID string) (int, error) {
	if db.DB == nil {
		return 0, errors.New("mysql indisponível")
	}
	var n int
	err := db.DB.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM billing_invoices WHERE organization_id = ? AND status IN ('pending', 'overdue')`,
		strings.TrimSpace(orgID),
	).Scan(&n)
	return n, err
}

func timeOrNil(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.UTC().Format("2006-01-02 15:04:05.000")
}
