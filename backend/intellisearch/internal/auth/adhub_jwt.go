package auth

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const issuer = "ad-hub-auth"

// Claims JWT após login.
type Claims struct {
	Role  string `json:"role"`
	OrgID string `json:"oid,omitempty"`
	jwt.RegisteredClaims
}

func jwtSecret() ([]byte, error) {
	s := strings.TrimSpace(os.Getenv("ADHUB_JWT_SECRET"))
	if s == "" {
		return nil, errors.New("ADHUB_JWT_SECRET não definido")
	}
	return []byte(s), nil
}

// SignToken emite JWT (validade 7 dias). `loginKey` fica em `sub`.
func SignToken(loginKey, role, orgID string) (string, error) {
	sec, err := jwtSecret()
	if err != nil {
		return "", err
	}
	now := time.Now()
	claims := Claims{
		Role:  role,
		OrgID: orgID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   loginKey,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims)
	return t.SignedString(sec)
}

// ParseToken valida Bearer token.
func ParseToken(token string) (*Claims, error) {
	sec, err := jwtSecret()
	if err != nil {
		return nil, err
	}
	tok, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return sec, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok || !tok.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
