package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"norter/intellisearch/internal/db"
)

// Row utilizador AD-Hub (API continua a expor user_json agregado ao cliente).
type Row struct {
	LoginKey     string
	PasswordHash string
	UserJSON     json.RawMessage
}

// NormalizeLoginKey espelha o cliente (sem espaços/vírgulas, minúsculas).
func NormalizeLoginKey(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		if r == ' ' || r == ',' {
			continue
		}
		b.WriteRune(r)
	}
	return strings.ToLower(b.String())
}

func stringFromMap(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func boolFromMap(m map[string]interface{}, key string) bool {
	v, ok := m[key]
	if !ok || v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case float64:
		return t != 0
	default:
		return false
	}
}

func orgNullFromMap(m map[string]interface{}) sql.NullString {
	s := stringFromMap(m, "organizationId")
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullString(s string) sql.NullString {
	s = strings.TrimSpace(s)
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func allowedModulesArg(m map[string]interface{}) (interface{}, error) {
	v, ok := m["allowedModules"]
	if !ok || v == nil {
		return nil, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func mapFromUserJSON(userJSON json.RawMessage) (map[string]interface{}, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(userJSON, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func userJSONFromRow(
	username, role, name, email string,
	orgID sql.NullString,
	phone, document sql.NullString,
	avatar sql.NullString,
	cmb, cdc, mcp, disabled, hidePl int64,
	allowed sql.NullString,
) (json.RawMessage, error) {
	u := map[string]interface{}{
		"username": username,
		"role":     role,
		"name":     name,
		"email":    email,
	}
	if phone.Valid {
		u["phone"] = phone.String
	} else {
		u["phone"] = ""
	}
	if document.Valid {
		u["document"] = document.String
	} else {
		u["document"] = ""
	}
	if orgID.Valid {
		u["organizationId"] = orgID.String
	}
	if avatar.Valid {
		u["avatarDataUrl"] = avatar.String
	} else {
		u["avatarDataUrl"] = nil
	}
	u["canManageBoard"] = cmb != 0
	u["canDeleteBoardCards"] = cdc != 0
	u["mustChangePassword"] = mcp != 0
	if disabled != 0 {
		u["disabled"] = true
	}
	if hidePl != 0 {
		u["hideFromPlatformList"] = true
	}
	if allowed.Valid && strings.TrimSpace(allowed.String) != "" {
		var raw interface{}
		if err := json.Unmarshal([]byte(allowed.String), &raw); err == nil {
			u["allowedModules"] = raw
		}
	}
	return json.Marshal(u)
}

func scanOneUserRow(row *sql.Row) (Row, error) {
	var (
		orgID                         sql.NullString
		username, role, name, email   string
		phone, document               sql.NullString
		passwordHash                  string
		avatar                        sql.NullString
		cmb, cdc, mcp                 int64
		allowed                       sql.NullString
		disabled, hideFromPlatformLst int64
	)
	err := row.Scan(
		&orgID, &username, &role, &name, &email, &phone, &document,
		&passwordHash, &avatar, &cmb, &cdc, &mcp, &allowed, &disabled, &hideFromPlatformLst,
	)
	if err != nil {
		return Row{}, err
	}
	uj, err := userJSONFromRow(username, role, name, email, orgID, phone, document, avatar, cmb, cdc, mcp, disabled, hideFromPlatformLst, allowed)
	if err != nil {
		return Row{}, err
	}
	return Row{
		LoginKey:     username,
		PasswordHash: passwordHash,
		UserJSON:     uj,
	}, nil
}

// ListAll devolve todos os utilizadores (para sincronizar o cliente).
func ListAll(ctx context.Context) ([]Row, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	rows, err := db.DB.QueryContext(ctx, `
SELECT organization_id, username, role, name, email, phone, document,
       password_hash, avatar_data_url, can_manage_board, can_delete_board_cards,
       must_change_password, allowed_modules, disabled, hide_from_platform_list
FROM users
ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var (
			orgID                         sql.NullString
			username, role, name, email   string
			phone, document               sql.NullString
			passwordHash                  string
			avatar                        sql.NullString
			cmb, cdc, mcp                 int64
			allowed                       sql.NullString
			disabled, hideFromPlatformLst int64
		)
		if err := rows.Scan(
			&orgID, &username, &role, &name, &email, &phone, &document,
			&passwordHash, &avatar, &cmb, &cdc, &mcp, &allowed, &disabled, &hideFromPlatformLst,
		); err != nil {
			return nil, err
		}
		uj, err := userJSONFromRow(username, role, name, email, orgID, phone, document, avatar, cmb, cdc, mcp, disabled, hideFromPlatformLst, allowed)
		if err != nil {
			return nil, err
		}
		out = append(out, Row{
			LoginKey:     username,
			PasswordHash: passwordHash,
			UserJSON:     uj,
		})
	}
	return out, rows.Err()
}

// GetByLoginKey obtém uma linha.
func GetByLoginKey(ctx context.Context, loginRaw string) (*Row, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginRaw)
	row := db.DB.QueryRowContext(ctx, `
SELECT organization_id, username, role, name, email, phone, document,
       password_hash, avatar_data_url, can_manage_board, can_delete_board_cards,
       must_change_password, allowed_modules, disabled, hide_from_platform_list
FROM users WHERE username = ?`, key)
	r, err := scanOneUserRow(row)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// Count devolve o número de linhas (para seed).
func Count(ctx context.Context) (int, error) {
	if db.DB == nil {
		return 0, errors.New("mysql indisponível")
	}
	var n int
	err := db.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

// UpdateUserJSON grava o perfil a partir do JSON agregado (sem alterar password_hash aqui).
func UpdateUserJSON(ctx context.Context, loginRaw string, userJSON json.RawMessage) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginRaw)
	m, err := mapFromUserJSON(userJSON)
	if err != nil {
		return err
	}
	m["username"] = key

	role := stringFromMap(m, "role")
	if role != "admin" && role != "user" {
		role = "user"
	}
	name := strings.TrimSpace(stringFromMap(m, "name"))
	if name == "" {
		name = key
	}
	email := strings.TrimSpace(stringFromMap(m, "email"))
	if email == "" {
		return errors.New("email obrigatório")
	}
	allowed, err := allowedModulesArg(m)
	if err != nil {
		return err
	}
	res, err := db.DB.ExecContext(ctx, `
UPDATE users SET
  organization_id = ?,
  role = ?,
  name = ?,
  email = ?,
  phone = ?,
  document = ?,
  avatar_data_url = ?,
  can_manage_board = ?,
  can_delete_board_cards = ?,
  must_change_password = ?,
  allowed_modules = ?,
  disabled = ?,
  hide_from_platform_list = ?,
  updated_at = ?
WHERE username = ?`,
		orgNullFromMap(m),
		role,
		name,
		email,
		nullString(stringFromMap(m, "phone")),
		nullString(stringFromMap(m, "document")),
		nullString(stringFromMap(m, "avatarDataUrl")),
		boolToTiny(boolFromMap(m, "canManageBoard")),
		boolToTiny(boolFromMap(m, "canDeleteBoardCards")),
		boolToTiny(boolFromMap(m, "mustChangePassword")),
		allowed,
		boolToTiny(boolFromMap(m, "disabled")),
		boolToTiny(boolFromMap(m, "hideFromPlatformList")),
		time.Now().UTC(),
		key,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func boolToTiny(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

// UpdatePassword altera só o hash.
func UpdatePassword(ctx context.Context, loginRaw, passwordHash string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginRaw)
	_, err := db.DB.ExecContext(ctx,
		`UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?`,
		passwordHash, time.Now().UTC(), key)
	return err
}

// Delete remove utilizador.
func Delete(ctx context.Context, loginRaw string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginRaw)
	_, err := db.DB.ExecContext(ctx, `DELETE FROM users WHERE username = ?`, key)
	return err
}

// InsertUser cria utilizador (registo completo).
func InsertUser(ctx context.Context, loginRaw, passwordHash string, userJSON json.RawMessage) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginRaw)
	m, err := mapFromUserJSON(userJSON)
	if err != nil {
		return err
	}
	m["username"] = key

	role := stringFromMap(m, "role")
	if role != "admin" && role != "user" {
		role = "user"
	}
	name := strings.TrimSpace(stringFromMap(m, "name"))
	if name == "" {
		name = key
	}
	email := strings.TrimSpace(stringFromMap(m, "email"))
	if email == "" {
		return errors.New("email obrigatório")
	}
	allowed, err := allowedModulesArg(m)
	if err != nil {
		return err
	}
	id := uuid.New().String()
	_, err = db.DB.ExecContext(ctx, `
INSERT INTO users (
  id, organization_id, username, role, name, email, phone, document, password_hash,
  avatar_data_url, can_manage_board, can_delete_board_cards, must_change_password,
  allowed_modules, disabled, hide_from_platform_list
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id,
		orgNullFromMap(m),
		key,
		role,
		name,
		email,
		nullString(stringFromMap(m, "phone")),
		nullString(stringFromMap(m, "document")),
		passwordHash,
		nullString(stringFromMap(m, "avatarDataUrl")),
		boolToTiny(boolFromMap(m, "canManageBoard")),
		boolToTiny(boolFromMap(m, "canDeleteBoardCards")),
		boolToTiny(boolFromMap(m, "mustChangePassword")),
		allowed,
		boolToTiny(boolFromMap(m, "disabled")),
		boolToTiny(boolFromMap(m, "hideFromPlatformList")),
	)
	return err
}

// NormalizeEmail para comparação na base (minúsculas, sem espaços nas pontas).
func NormalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// GetByEmail obtém utilizador pelo e-mail (primeira linha se houver duplicados — evite e-mails duplicados).
func GetByEmail(ctx context.Context, emailRaw string) (*Row, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	em := NormalizeEmail(emailRaw)
	if em == "" || !strings.Contains(em, "@") {
		return nil, sql.ErrNoRows
	}
	row := db.DB.QueryRowContext(ctx, `
SELECT organization_id, username, role, name, email, phone, document,
       password_hash, avatar_data_url, can_manage_board, can_delete_board_cards,
       must_change_password, allowed_modules, disabled, hide_from_platform_list
FROM users WHERE LOWER(TRIM(email)) = ? ORDER BY username LIMIT 1`, em)
	r, err := scanOneUserRow(row)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// SetPasswordResetToken grava token e expiração (UTC).
func SetPasswordResetToken(ctx context.Context, loginKey, token string, expiresUTC time.Time) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginKey)
	_, err := db.DB.ExecContext(ctx, `
UPDATE users SET password_reset_token = ?, password_reset_expires_at = ?, updated_at = ?
WHERE username = ?`,
		token, expiresUTC.UTC(), time.Now().UTC(), key)
	return err
}

// ClearPasswordResetToken remove token após uso ou cancelamento.
func ClearPasswordResetToken(ctx context.Context, loginKey string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	key := NormalizeLoginKey(loginKey)
	_, err := db.DB.ExecContext(ctx, `
UPDATE users SET password_reset_token = NULL, password_reset_expires_at = NULL, updated_at = ?
WHERE username = ?`,
		time.Now().UTC(), key)
	return err
}

// GetByPasswordResetToken resolve utilizador por token válido e não expirado.
func GetByPasswordResetToken(ctx context.Context, token string) (*Row, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	t := strings.TrimSpace(token)
	if t == "" {
		return nil, sql.ErrNoRows
	}
	row := db.DB.QueryRowContext(ctx, `
SELECT organization_id, username, role, name, email, phone, document,
       password_hash, avatar_data_url, can_manage_board, can_delete_board_cards,
       must_change_password, allowed_modules, disabled, hide_from_platform_list
FROM users
WHERE password_reset_token = ?
  AND password_reset_expires_at IS NOT NULL
  AND password_reset_expires_at > UTC_TIMESTAMP(3)`, t)
	r, err := scanOneUserRow(row)
	if err != nil {
		return nil, err
	}
	return &r, nil
}
