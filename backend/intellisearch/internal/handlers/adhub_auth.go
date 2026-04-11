package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/mail"
	"norter/intellisearch/internal/repo"
)

func isPlatformOperatorLogin(loginKey string) bool {
	k := strings.ToLower(strings.TrimSpace(loginKey))
	return k == "admin" || k == "qtrafficadmin"
}

// Alinha à regra do front (passwordPolicy.ts): ≥6, minúscula, maiúscula, caractere não alfanumérico.
func adHubStrongPassword(s string) bool {
	if len(s) < 6 {
		return false
	}
	var lo, up, nonAlnum bool
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
			lo = true
		case r >= 'A' && r <= 'Z':
			up = true
		default:
			if r < '0' || r > '9' {
				nonAlnum = true
			}
		}
	}
	return lo && up && nonAlnum
}

// Nome da base no MYSQL_DSN (ex.: johnn315_db-adhub-prd) para confirmar no DBeaver que é a mesma.
func mysqlDatabaseNameFromDSN() string {
	dsn := strings.TrimSpace(os.Getenv("MYSQL_DSN"))
	if dsn == "" {
		return ""
	}
	if idx := strings.Index(dsn, ")/"); idx >= 0 {
		rest := dsn[idx+2:]
		if j := strings.Index(rest, "?"); j >= 0 {
			rest = rest[:j]
		}
		return strings.TrimSpace(rest)
	}
	return ""
}

// AdHubPing GET /api/ad-hub/auth/ping
func AdHubPing(c *fiber.Ctx) error {
	out := fiber.Map{"ok": true, "service": "ad-hub-auth"}
	if db.DB != nil {
		out["db"] = true
		if name := mysqlDatabaseNameFromDSN(); name != "" {
			out["database"] = name
		}
	} else {
		out["db"] = false
	}
	// Diagnóstico sem expor o DSN: se está definido mas db=false, a ligação falhou (credenciais/host) — ver app.log ao arrancar.
	dsnSet := strings.TrimSpace(os.Getenv("MYSQL_DSN")) != ""
	out["mysql_dsn_set"] = dsnSet
	if !dsnSet {
		out["hint"] = "Defina MYSQL_DSN no .env ao lado do binário (ex.: ~/apps/minha-api/.env) e reinicie a API."
	} else if db.DB == nil {
		out["hint"] = "MYSQL_DSN está definido mas a ligação MySQL falhou — confira user/senha/host no DSN, encoding de caracteres na senha e o log ao arrancar (app.log)."
	}
	out["jwt_ready"] = strings.TrimSpace(os.Getenv("ADHUB_JWT_SECRET")) != ""
	return c.JSON(out)
}

type loginBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AdHubLogin POST /api/ad-hub/auth/login — campo `username` aceita login normalizado ou e-mail.
func AdHubLogin(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "MySQL indisponível — defina MYSQL_DSN",
		})
	}
	var body loginBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	id := strings.TrimSpace(body.Username)
	if id == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Credenciais em falta"})
	}
	var row *repo.Row
	var err error
	if strings.Contains(id, "@") {
		row, err = repo.GetByEmail(c.Context(), id)
	} else {
		key := repo.NormalizeLoginKey(id)
		row, err = repo.GetByLoginKey(c.Context(), key)
	}
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Credenciais inválidas"})
	}
	key := row.LoginKey
	if err := bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte(body.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Credenciais inválidas"})
	}
	var u map[string]interface{}
	if err := json.Unmarshal(row.UserJSON, &u); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Perfil inválido"})
	}
	if dis, ok := u["disabled"].(bool); ok && dis {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Conta desativada"})
	}
	role, _ := u["role"].(string)
	orgID, _ := u["organizationId"].(string)
	token, err := adhubjwt.SignToken(key, role, orgID)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Servidor sem ADHUB_JWT_SECRET — configure no .env",
		})
	}
	return c.JSON(fiber.Map{
		"token": token,
		"user":  json.RawMessage(row.UserJSON),
	})
}

type passwordBody struct {
	Username        string `json:"username"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// AdHubChangePassword POST /api/ad-hub/auth/password — sem JWT; valida senha atual na BD.
func AdHubChangePassword(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	var body passwordBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	key := repo.NormalizeLoginKey(body.Username)
	if key == "" || body.CurrentPassword == "" || body.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dados em falta"})
	}
	if len(body.NewPassword) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Senha nova demasiado curta"})
	}
	row, err := repo.GetByLoginKey(c.Context(), key)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Credenciais inválidas"})
	}
	if err := bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte(body.CurrentPassword)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Senha atual incorreta"})
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gerar hash"})
	}
	if err := repo.UpdatePassword(c.Context(), key, string(hash)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gravar"})
	}
	_ = repo.ClearPasswordResetToken(c.Context(), key)
	// atualizar mustChangePassword no JSON se existir
	var u map[string]interface{}
	_ = json.Unmarshal(row.UserJSON, &u)
	u["mustChangePassword"] = false
	nextJSON, _ := json.Marshal(u)
	_ = repo.UpdateUserJSON(c.Context(), key, nextJSON)
	return c.JSON(fiber.Map{"ok": true})
}

type forgotBody struct {
	Email string `json:"email"`
}

// AdHubForgotPassword POST /api/ad-hub/auth/forgot-password — resposta genérica (não revela se o e-mail existe).
func AdHubForgotPassword(c *fiber.Ctx) error {
	okMsg := fiber.Map{
		"ok":      true,
		"message": "Se o e-mail estiver registado, receberá um link para redefinir a senha.",
	}
	if db.DB == nil {
		return c.JSON(okMsg)
	}
	var body forgotBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	em := repo.NormalizeEmail(body.Email)
	if em == "" || !strings.Contains(em, "@") {
		return c.JSON(okMsg)
	}
	row, err := repo.GetByEmail(c.Context(), em)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(okMsg)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao processar"})
	}
	var u map[string]interface{}
	if err := json.Unmarshal(row.UserJSON, &u); err != nil {
		return c.JSON(okMsg)
	}
	if dis, ok := u["disabled"].(bool); ok && dis {
		return c.JSON(okMsg)
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gerar token"})
	}
	token := hex.EncodeToString(buf)
	exp := time.Now().UTC().Add(1 * time.Hour)
	if err := repo.SetPasswordResetToken(c.Context(), row.LoginKey, token, exp); err != nil {
		log.Printf("adhub forgot-password: SetPasswordResetToken: %v — execute a migração 003_password_reset.sql?", err)
		return c.JSON(okMsg)
	}
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("ADHUB_PUBLIC_APP_URL")), "/")
	if base == "" {
		base = "http://localhost:8080"
	}
	link := fmt.Sprintf("%s/reset-password?token=%s", base, token)
	subject := "Recuperação de senha — AD-Hub"
	bodyText := fmt.Sprintf("Olá,\n\nPara definir uma nova senha, abra o link (válido cerca de 1 hora):\n\n%s\n\nSe não pediu este e-mail, ignore.\n", link)
	sent, mErr := mail.SendPlain(subject, bodyText, []string{em})
	if mErr != nil {
		log.Printf("adhub: envio SMTP falhou (%v). Link para %s: %s", mErr, em, link)
		return c.JSON(okMsg)
	}
	if !sent {
		log.Printf("adhub: SMTP não configurado — link de recuperação para %s: %s", em, link)
	}
	return c.JSON(okMsg)
}

type resetBody struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

// AdHubResetPassword POST /api/ad-hub/auth/reset-password
func AdHubResetPassword(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	var body resetBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if strings.TrimSpace(body.Token) == "" || body.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token e nova senha são obrigatórios"})
	}
	if !adHubStrongPassword(body.NewPassword) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Senha inválida: mínimo 6 caracteres, com maiúscula, minúscula e símbolo",
		})
	}
	row, err := repo.GetByPasswordResetToken(c.Context(), body.Token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Link inválido ou expirado — peça um novo."})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao validar token"})
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gerar hash"})
	}
	key := row.LoginKey
	if err := repo.UpdatePassword(c.Context(), key, string(hash)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gravar senha"})
	}
	_ = repo.ClearPasswordResetToken(c.Context(), key)
	var u map[string]interface{}
	_ = json.Unmarshal(row.UserJSON, &u)
	u["mustChangePassword"] = false
	nextJSON, _ := json.Marshal(u)
	_ = repo.UpdateUserJSON(c.Context(), key, nextJSON)
	return c.JSON(fiber.Map{"ok": true})
}

func adHubBearerToken(c *fiber.Ctx) string {
	h := c.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return ""
	}
	return strings.TrimSpace(h[7:])
}

// AdHubRegistry GET /api/ad-hub/auth/registry — lista utilizadores visíveis para o token.
func AdHubRegistry(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	tok := adHubBearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	claims, err := adhubjwt.ParseToken(tok)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}
	sub := strings.TrimSpace(claims.Subject)
	if sub == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}

	ctx := context.Background()
	all, err := repo.ListAll(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar"})
	}

	entries := make(map[string]map[string]interface{})
	for _, row := range all {
		var u map[string]interface{}
		if err := json.Unmarshal(row.UserJSON, &u); err != nil {
			continue
		}
		login := row.LoginKey
		if !includeInRegistry(sub, claims.Role, claims.OrgID, login, u) {
			continue
		}
		entries[login] = map[string]interface{}{
			"user": u,
		}
	}
	return c.JSON(fiber.Map{"entries": entries})
}

func includeInRegistry(actorKey, actorRole, actorOrgID, rowKey string, rowUser map[string]interface{}) bool {
	if actorKey == rowKey {
		return true
	}
	if isPlatformOperatorLogin(actorKey) {
		return true
	}
	if actorRole != "admin" {
		return false
	}
	rowOrg, _ := rowUser["organizationId"].(string)
	if actorOrgID == "" {
		// admin de plataforma sem org no token — não devolver outros (só self já coberto)
		return false
	}
	return rowOrg == actorOrgID
}

// AdHubCreateUser POST /api/ad-hub/auth/users — admin (JWT).
type createUserBody struct {
	Username string                 `json:"username"`
	Password string                 `json:"password"`
	User     map[string]interface{} `json:"user"`
}

func AdHubCreateUser(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	tok := adHubBearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	claims, err := adhubjwt.ParseToken(tok)
	if err != nil || claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	var body createUserBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	key := repo.NormalizeLoginKey(body.Username)
	if key == "" || body.Password == "" || body.User == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dados em falta"})
	}
	email, _ := body.User["email"].(string)
	if strings.TrimSpace(email) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "E-mail é obrigatório"})
	}
	if _, err := repo.GetByLoginKey(c.Context(), key); err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Login já existe"})
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao verificar login"})
	}
	body.User["username"] = key
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "hash"})
	}
	userJSON, err := json.Marshal(body.User)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "perfil inválido"})
	}
	if err := repo.InsertUser(c.Context(), key, string(hash), userJSON); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "email obrigat") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "E-mail é obrigatório"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao criar"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// AdHubPatchUser PATCH /api/ad-hub/auth/users/:login
func AdHubPatchUser(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	tok := adHubBearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	claims, err := adhubjwt.ParseToken(tok)
	if err != nil || claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	target := repo.NormalizeLoginKey(c.Params("login"))
	if target == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "login inválido"})
	}
	if !actorCanManage(claims, target) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	var patch map[string]interface{}
	if err := c.BodyParser(&patch); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	row, err := repo.GetByLoginKey(c.Context(), target)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Utilizador não encontrado"})
	}
	var u map[string]interface{}
	if err := json.Unmarshal(row.UserJSON, &u); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "perfil corrupto"})
	}
	if userObj, ok := patch["user"].(map[string]interface{}); ok {
		for k, v := range userObj {
			u[k] = v
		}
	}
	if np, ok := patch["newPassword"].(string); ok && np != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(np), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "hash"})
		}
		if err := repo.UpdatePassword(c.Context(), target, string(hash)); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro senha"})
		}
	}
	nextJSON, err := json.Marshal(u)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "serial"})
	}
	if err := repo.UpdateUserJSON(c.Context(), target, nextJSON); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gravar"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func actorCanManage(claims *adhubjwt.Claims, targetKey string) bool {
	if isPlatformOperatorLogin(claims.Subject) {
		return true
	}
	if claims.Role != "admin" {
		return false
	}
	// org admin: só mesma org — carregar target
	ctx := context.Background()
	row, err := repo.GetByLoginKey(ctx, targetKey)
	if err != nil {
		return false
	}
	var u map[string]interface{}
	_ = json.Unmarshal(row.UserJSON, &u)
	rowOrg, _ := u["organizationId"].(string)
	return rowOrg == claims.OrgID && claims.OrgID != ""
}

// AdHubDeleteUser DELETE /api/ad-hub/auth/users/:login
func AdHubDeleteUser(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	tok := adHubBearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	claims, err := adhubjwt.ParseToken(tok)
	if err != nil || claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	target := repo.NormalizeLoginKey(c.Params("login"))
	if target == "admin" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Não é possível remover o administrador principal"})
	}
	if !actorCanManage(claims, target) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	if err := repo.Delete(c.Context(), target); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao remover"})
	}
	return c.JSON(fiber.Map{"ok": true})
}
