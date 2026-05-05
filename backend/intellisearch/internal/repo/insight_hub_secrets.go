package repo

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// insightHubVaultKey deriva chave AES-256 a partir de ADHUB_INSIGHT_HUB_SECRET_KEY (hex 64) ou cai em ADHUB_JWT_SECRET (hash).
// Recomendação: gerar 32 bytes aleatórios em hex (64 chars) e definir a env var no servidor.
func insightHubVaultKey() ([]byte, error) {
	v := strings.TrimSpace(os.Getenv("ADHUB_INSIGHT_HUB_SECRET_KEY"))
	if v != "" {
		raw, err := hex.DecodeString(v)
		if err == nil && len(raw) == 32 {
			return raw, nil
		}
		if err != nil {
			// Permitir 32 bytes em texto bruto também (fallback compat).
			if len(v) == 32 {
				return []byte(v), nil
			}
		}
	}
	// Fallback: usa hash determinístico do JWT secret (não ideal — recomenda-se chave dedicada).
	jwt := strings.TrimSpace(os.Getenv("ADHUB_JWT_SECRET"))
	if jwt == "" {
		return nil, errors.New("ADHUB_INSIGHT_HUB_SECRET_KEY ou ADHUB_JWT_SECRET em falta para cifrar tokens")
	}
	if len(jwt) >= 32 {
		return []byte(jwt[:32]), nil
	}
	pad := make([]byte, 32)
	copy(pad, []byte(jwt))
	return pad, nil
}

// EncryptInsightHubSecret aplica AES-GCM e devolve nonce + cipher.
func EncryptInsightHubSecret(plain []byte) (nonce []byte, ciphertext []byte, err error) {
	key, err := insightHubVaultKey()
	if err != nil {
		return nil, nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	ct := gcm.Seal(nil, nonce, plain, nil)
	return nonce, ct, nil
}

// DecryptInsightHubSecret reverte AES-GCM (nonce + cipher).
func DecryptInsightHubSecret(nonce, ciphertext []byte) ([]byte, error) {
	key, err := insightHubVaultKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// SaveInsightHubSecret cifra plaintext e regista linha; devolve token_ref para gravar em insight_hub_connections.
func SaveInsightHubSecret(ctx context.Context, orgID string, brandID *string, plaintext []byte, expiresAt *time.Time) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	if oid == "" || len(plaintext) == 0 {
		return "", errors.New("dados em falta para guardar segredo")
	}
	nonce, ct, err := EncryptInsightHubSecret(plaintext)
	if err != nil {
		return "", err
	}
	ref := NewUUID()
	var brand interface{}
	if brandID != nil && strings.TrimSpace(*brandID) != "" {
		brand = strings.TrimSpace(*brandID)
	}
	var exp interface{}
	if expiresAt != nil {
		exp = expiresAt.UTC().Format("2006-01-02 15:04:05.000")
	}
	_, err = db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_secrets (token_ref, organization_id, brand_id, cipher_text, nonce, algo, expires_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, 'aes-256-gcm', ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		ref, oid, brand, ct, nonce, exp,
	)
	if err != nil {
		return "", err
	}
	return ref, nil
}

// GetInsightHubSecret devolve plaintext após validar isolamento por organização.
func GetInsightHubSecret(ctx context.Context, orgID, tokenRef string) ([]byte, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(orgID)
	ref := strings.TrimSpace(tokenRef)
	if oid == "" || ref == "" {
		return nil, errors.New("parametros em falta")
	}
	var ct, nonce []byte
	err := db.DB.QueryRowContext(ctx,
		`SELECT cipher_text, nonce FROM insight_hub_secrets WHERE token_ref = ? AND organization_id = ?`, ref, oid,
	).Scan(&ct, &nonce)
	if err != nil {
		return nil, err
	}
	return DecryptInsightHubSecret(nonce, ct)
}

// DeleteInsightHubSecret remove cifra (revogar / desconectar).
func DeleteInsightHubSecret(ctx context.Context, orgID, tokenRef string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	_, err := db.DB.ExecContext(ctx,
		`DELETE FROM insight_hub_secrets WHERE token_ref = ? AND organization_id = ?`,
		strings.TrimSpace(tokenRef), strings.TrimSpace(orgID),
	)
	return err
}
