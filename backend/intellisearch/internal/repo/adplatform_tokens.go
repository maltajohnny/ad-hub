package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

// OAuthTokenRow linha em ad_platform_oauth_tokens.
type OAuthTokenRow struct {
	OrgID                 string
	MediaClientID         string
	Platform              string
	AccessToken           string
	RefreshToken          sql.NullString
	TokenExpiresAt        sql.NullTime
	ExternalAccountID     sql.NullString
	ExternalAccountLabel  sql.NullString
	LastSpend             sql.NullFloat64
	LastROI               sql.NullFloat64
	LastCPA               sql.NullFloat64
	LastCurrency          sql.NullString
	MetricsSyncedAt       sql.NullTime
}

func allowedPlatform(p string) bool {
	switch strings.TrimSpace(p) {
	case "meta-ads", "instagram-ads", "tiktok-ads":
		return true
	default:
		return false
	}
}

// UpsertTokenAfterOAuth grava ou substitui token (limpa vínculo de conta e métricas antigas).
func UpsertTokenAfterOAuth(ctx context.Context, db *sql.DB, orgID, mediaClientID, platform, accessToken, refreshToken string, expiresAt *time.Time) error {
	if !allowedPlatform(platform) {
		return ErrInvalidPlatform
	}
	var rt interface{}
	if strings.TrimSpace(refreshToken) != "" {
		rt = refreshToken
	} else {
		rt = nil
	}
	var exp interface{}
	if expiresAt != nil {
		exp = *expiresAt
	} else {
		exp = nil
	}
	const q = `
INSERT INTO ad_platform_oauth_tokens (
  org_id, media_client_id, platform, access_token, refresh_token, token_expires_at,
  external_account_id, external_account_label,
  last_spend, last_roi, last_cpa, last_currency, metrics_synced_at,
  created_at, updated_at
) VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW(6),NOW(6))
ON DUPLICATE KEY UPDATE
  access_token = VALUES(access_token),
  refresh_token = VALUES(refresh_token),
  token_expires_at = VALUES(token_expires_at),
  external_account_id = NULL,
  external_account_label = NULL,
  last_spend = NULL,
  last_roi = NULL,
  last_cpa = NULL,
  last_currency = NULL,
  metrics_synced_at = NULL,
  updated_at = NOW(6)`
	_, err := db.ExecContext(ctx, q, orgID, mediaClientID, platform, accessToken, rt, exp)
	return err
}

// UpdateLinkAndMetrics define conta externa e último snapshot de métricas.
func UpdateLinkAndMetrics(ctx context.Context, db *sql.DB, orgID, mediaClientID, platform, externalID, externalLabel string, spend, roi, cpa float64, currency, syncedAtRFC3339 string) error {
	if !allowedPlatform(platform) {
		return ErrInvalidPlatform
	}
	t, _ := time.Parse(time.RFC3339, syncedAtRFC3339)
	const q = `
UPDATE ad_platform_oauth_tokens SET
  external_account_id = ?,
  external_account_label = ?,
  last_spend = ?,
  last_roi = ?,
  last_cpa = ?,
  last_currency = ?,
  metrics_synced_at = ?,
  updated_at = NOW(6)
WHERE org_id = ? AND media_client_id = ? AND platform = ?`
	_, err := db.ExecContext(ctx, q, externalID, externalLabel, spend, roi, cpa, currency, t, orgID, mediaClientID, platform)
	return err
}

// UpdateMetricsOnly atualiza só KPIs (refresh).
func UpdateMetricsOnly(ctx context.Context, db *sql.DB, orgID, mediaClientID, platform string, spend, roi, cpa float64, currency, syncedAtRFC3339 string) error {
	if !allowedPlatform(platform) {
		return ErrInvalidPlatform
	}
	t, _ := time.Parse(time.RFC3339, syncedAtRFC3339)
	const q = `
UPDATE ad_platform_oauth_tokens SET
  last_spend = ?,
  last_roi = ?,
  last_cpa = ?,
  last_currency = ?,
  metrics_synced_at = ?,
  updated_at = NOW(6)
WHERE org_id = ? AND media_client_id = ? AND platform = ?`
	res, err := db.ExecContext(ctx, q, spend, roi, cpa, currency, t, orgID, mediaClientID, platform)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// GetToken lê a linha do vínculo org+cliente+plataforma.
func GetToken(ctx context.Context, db *sql.DB, orgID, mediaClientID, platform string) (*OAuthTokenRow, error) {
	if !allowedPlatform(platform) {
		return nil, ErrInvalidPlatform
	}
	const q = `
SELECT org_id, media_client_id, platform, access_token, refresh_token, token_expires_at,
       external_account_id, external_account_label,
       last_spend, last_roi, last_cpa, last_currency, metrics_synced_at
FROM ad_platform_oauth_tokens
WHERE org_id = ? AND media_client_id = ? AND platform = ?`
	row := db.QueryRowContext(ctx, q, orgID, mediaClientID, platform)
	var r OAuthTokenRow
	err := row.Scan(
		&r.OrgID, &r.MediaClientID, &r.Platform, &r.AccessToken, &r.RefreshToken, &r.TokenExpiresAt,
		&r.ExternalAccountID, &r.ExternalAccountLabel,
		&r.LastSpend, &r.LastROI, &r.LastCPA, &r.LastCurrency, &r.MetricsSyncedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// ListTokensForClient todas as plataformas com linha na base para este cliente.
func ListTokensForClient(ctx context.Context, db *sql.DB, orgID, mediaClientID string) ([]OAuthTokenRow, error) {
	const q = `
SELECT org_id, media_client_id, platform, access_token, refresh_token, token_expires_at,
       external_account_id, external_account_label,
       last_spend, last_roi, last_cpa, last_currency, metrics_synced_at
FROM ad_platform_oauth_tokens
WHERE org_id = ? AND media_client_id = ?
ORDER BY platform`
	rows, err := db.QueryContext(ctx, q, orgID, mediaClientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OAuthTokenRow
	for rows.Next() {
		var r OAuthTokenRow
		if err := rows.Scan(
			&r.OrgID, &r.MediaClientID, &r.Platform, &r.AccessToken, &r.RefreshToken, &r.TokenExpiresAt,
			&r.ExternalAccountID, &r.ExternalAccountLabel,
			&r.LastSpend, &r.LastROI, &r.LastCPA, &r.LastCurrency, &r.MetricsSyncedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

var (
	ErrNotFound        = errors.New("token não encontrado para org/cliente/plataforma")
	ErrInvalidPlatform = errors.New("plataforma inválida")
)
