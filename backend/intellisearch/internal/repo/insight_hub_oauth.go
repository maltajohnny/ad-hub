package repo

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// InsightHubOAuthState representa contexto de uma autorização em andamento.
type InsightHubOAuthState struct {
	OrgID       string
	BrandID     string
	Provider    string
	ReturnPath  string
	RedirectURI string
}

// NewOAuthState gera token aleatório (32 bytes hex = 64 chars), guarda contexto e devolve string para o front passar ao provider.
func NewOAuthState(ctx context.Context, orgID, brandID, provider, returnPath, redirectURI string, ttl time.Duration) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	if strings.TrimSpace(orgID) == "" || strings.TrimSpace(brandID) == "" || strings.TrimSpace(provider) == "" {
		return "", errors.New("dados em falta")
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	state := hex.EncodeToString(buf)
	exp := time.Now().UTC().Add(ttl).Format("2006-01-02 15:04:05.000")
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_oauth_states (state, organization_id, brand_id, provider, return_path, redirect_uri, expires_at, created_at)
VALUES (?, ?, ?, ?, NULLIF(?,''), NULLIF(?,''), ?, UTC_TIMESTAMP(3))`,
		state, strings.TrimSpace(orgID), strings.TrimSpace(brandID), strings.TrimSpace(provider),
		strings.TrimSpace(returnPath), strings.TrimSpace(redirectURI), exp,
	)
	if err != nil {
		return "", err
	}
	return state, nil
}

// ConsumeOAuthState valida e remove (one-shot). Devolve contexto guardado.
func ConsumeOAuthState(ctx context.Context, state string) (*InsightHubOAuthState, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	st := strings.TrimSpace(state)
	if st == "" {
		return nil, errors.New("state vazio")
	}

	var s InsightHubOAuthState
	var returnPath, redirectURI *string
	row := db.DB.QueryRowContext(ctx, `
SELECT organization_id, brand_id, provider, return_path, redirect_uri
FROM insight_hub_oauth_states
WHERE state = ? AND expires_at > UTC_TIMESTAMP(3)`, st)
	if err := row.Scan(&s.OrgID, &s.BrandID, &s.Provider, &returnPath, &redirectURI); err != nil {
		return nil, err
	}
	if returnPath != nil {
		s.ReturnPath = *returnPath
	}
	if redirectURI != nil {
		s.RedirectURI = *redirectURI
	}
	if _, err := db.DB.ExecContext(ctx, `DELETE FROM insight_hub_oauth_states WHERE state = ?`, st); err != nil {
		return nil, err
	}
	return &s, nil
}

// CleanupExpiredOAuthStates apaga states expirados (chamada periódica).
func CleanupExpiredOAuthStates(ctx context.Context) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	_, err := db.DB.ExecContext(ctx, `DELETE FROM insight_hub_oauth_states WHERE expires_at <= UTC_TIMESTAMP(3)`)
	return err
}
