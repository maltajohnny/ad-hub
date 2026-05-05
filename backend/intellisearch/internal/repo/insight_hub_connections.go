package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// InsightHubConnection representa uma ligação OAuth (provider) por marca.
type InsightHubConnection struct {
	ID                string  `json:"id"`
	BrandID           string  `json:"brandId"`
	Provider          string  `json:"provider"`
	ExternalAccountID string  `json:"externalAccountId,omitempty"`
	DisplayLabel      string  `json:"displayLabel,omitempty"`
	Status            string  `json:"status"`
	LastSyncedAt      *string `json:"lastSyncedAt,omitempty"`
	CreatedAt         string  `json:"createdAt"`
}

// UpsertInsightHubConnection grava (ou atualiza) ligação por par (brand_id, provider).
func UpsertInsightHubConnection(
	ctx context.Context,
	orgID, brandID, provider, externalAccountID, displayLabel, tokenRef, scopesJSON, status string,
) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	bid := strings.TrimSpace(brandID)
	prov := strings.TrimSpace(provider)
	if oid == "" || bid == "" || prov == "" {
		return "", errors.New("dados em falta")
	}

	var existingID string
	err := db.DB.QueryRowContext(ctx,
		`SELECT id FROM insight_hub_connections WHERE brand_id = ? AND provider = ? AND organization_id = ? LIMIT 1`,
		bid, prov, oid,
	).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	if existingID != "" {
		_, err = db.DB.ExecContext(ctx, `
UPDATE insight_hub_connections SET
  external_account_id = NULLIF(?,''),
  display_label = NULLIF(?,''),
  token_ref = NULLIF(?,''),
  scopes_json = ?,
  status = ?,
  updated_at = UTC_TIMESTAMP(3)
WHERE id = ?`,
			strings.TrimSpace(externalAccountID),
			strings.TrimSpace(displayLabel),
			strings.TrimSpace(tokenRef),
			nullIfEmptyJSONString(scopesJSON),
			strings.TrimSpace(status),
			existingID,
		)
		return existingID, err
	}

	id := NewUUID()
	_, err = db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_connections
  (id, organization_id, brand_id, provider, external_account_id, display_label, token_ref, scopes_json, status, created_at, updated_at)
VALUES (?, ?, ?, ?, NULLIF(?,''), NULLIF(?,''), NULLIF(?,''), ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, oid, bid, prov,
		strings.TrimSpace(externalAccountID),
		strings.TrimSpace(displayLabel),
		strings.TrimSpace(tokenRef),
		nullIfEmptyJSONString(scopesJSON),
		strings.TrimSpace(status),
	)
	return id, err
}

func nullIfEmptyJSONString(s string) interface{} {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return s
}

// ListInsightHubConnections devolve ligações por marca (todas se brandID vazio).
func ListInsightHubConnections(ctx context.Context, orgID, brandID string) ([]InsightHubConnection, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" {
		return nil, errors.New("org em falta")
	}
	q := `
SELECT c.id, c.brand_id, c.provider, COALESCE(c.external_account_id,''), COALESCE(c.display_label,''), c.status,
       (SELECT DATE_FORMAT(s.last_synced_at, '%Y-%m-%dT%H:%i:%sZ') FROM insight_hub_sync_state s WHERE s.connection_id = c.id),
       DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%sZ')
FROM insight_hub_connections c
WHERE c.organization_id = ?`
	args := []interface{}{oid}
	if bid := strings.TrimSpace(brandID); bid != "" {
		q += " AND c.brand_id = ?"
		args = append(args, bid)
	}
	q += " ORDER BY c.created_at DESC"

	rows, err := db.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InsightHubConnection
	for rows.Next() {
		var c InsightHubConnection
		var lastSync sql.NullString
		if err := rows.Scan(
			&c.ID, &c.BrandID, &c.Provider, &c.ExternalAccountID, &c.DisplayLabel, &c.Status, &lastSync, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		if lastSync.Valid {
			s := lastSync.String
			c.LastSyncedAt = &s
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetInsightHubConnectionTokenRef obtém token_ref isolado por org.
func GetInsightHubConnectionTokenRef(ctx context.Context, orgID, connectionID string) (string, string, string, error) {
	if db.DB == nil {
		return "", "", "", errors.New("mysql indisponível")
	}
	var tokenRef sql.NullString
	var brandID, provider string
	err := db.DB.QueryRowContext(ctx,
		`SELECT brand_id, provider, token_ref FROM insight_hub_connections WHERE id = ? AND organization_id = ?`,
		strings.TrimSpace(connectionID), strings.TrimSpace(orgID),
	).Scan(&brandID, &provider, &tokenRef)
	if err != nil {
		return "", "", "", err
	}
	return brandID, provider, tokenRef.String, nil
}

// DeleteInsightHubConnection remove conexão e segredo associado (cascade nos jobs/metrics/posts).
func DeleteInsightHubConnection(ctx context.Context, orgID, connectionID string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	tokenRef := ""
	row := db.DB.QueryRowContext(ctx,
		`SELECT COALESCE(token_ref, '') FROM insight_hub_connections WHERE id = ? AND organization_id = ?`,
		strings.TrimSpace(connectionID), strings.TrimSpace(orgID),
	)
	_ = row.Scan(&tokenRef)
	if _, err := db.DB.ExecContext(ctx,
		`DELETE FROM insight_hub_connections WHERE id = ? AND organization_id = ?`,
		strings.TrimSpace(connectionID), strings.TrimSpace(orgID),
	); err != nil {
		return err
	}
	if tokenRef != "" {
		_ = DeleteInsightHubSecret(ctx, orgID, tokenRef)
	}
	return nil
}

// EnsureInsightHubSyncState cria/atualiza linha de estado para a connection.
func EnsureInsightHubSyncState(ctx context.Context, orgID, brandID, connectionID string, nextRunIn time.Duration) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	next := time.Now().UTC().Add(nextRunIn).Format("2006-01-02 15:04:05.000")
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_sync_state (connection_id, organization_id, brand_id, status, next_run_at, created_at, updated_at)
VALUES (?, ?, ?, 'idle', ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE next_run_at = VALUES(next_run_at), updated_at = UTC_TIMESTAMP(3)`,
		strings.TrimSpace(connectionID), strings.TrimSpace(orgID), strings.TrimSpace(brandID), next,
	)
	return err
}
