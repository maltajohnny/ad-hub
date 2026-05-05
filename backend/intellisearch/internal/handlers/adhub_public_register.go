package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

var slugRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

var reservedOrgSlugs = map[string]struct{}{
	"norter": {}, "qtraffic": {}, "admin": {}, "www": {}, "api": {}, "app": {},
	"landing": {}, "t": {}, "adhub": {},
}

// AdHubRegister POST /api/ad-hub/auth/register — cria organização + primeiro utilizador (admin da org).
func AdHubRegister(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	var body struct {
		Email            string `json:"email"`
		Password         string `json:"password"`
		Name             string `json:"name"`
		Username         string `json:"username"`
		OrganizationName string `json:"organizationName"`
		OrganizationSlug string `json:"organizationSlug"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	ip := clientIP(c)
	ua := strings.TrimSpace(c.Get("User-Agent"))
	email := repo.NormalizeEmail(body.Email)
	pw := strings.TrimSpace(body.Password)
	name := strings.TrimSpace(body.Name)
	local := strings.TrimSpace(strings.ToLower(body.Username))
	orgName := strings.TrimSpace(body.OrganizationName)
	slug := strings.TrimSpace(strings.ToLower(body.OrganizationSlug))
	identifier := email
	if identifier == "" {
		identifier = slug
	}
	if identifier == "" {
		identifier = "unknown"
	}
	state, err := repo.GetAuthLockState(c.Context(), "register", ip, identifier)
	if err == nil && state.LockUntil.Valid && state.LockUntil.Time.After(time.Now().UTC()) {
		_ = repo.RecordAuthEvent(c.Context(), "register", ip, identifier, "blocked", "active_lock", ua)
		return authLockedResponse(c, state.LockUntil.Time)
	}

	if email == "" || !strings.Contains(email, "@") {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "invalid_email", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "E-mail inválido"})
	}
	if !adHubStrongPassword(pw) {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "weak_password", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Senha inválida: mínimo 6 caracteres, com maiúscula, minúscula e símbolo",
		})
	}
	if name == "" || local == "" || orgName == "" || slug == "" {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "missing_fields", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Preencha nome, utilizador, organização e slug"})
	}
	if len(slug) < 2 || !slugRe.MatchString(slug) {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "invalid_slug", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Slug inválido (minúsculas, números e hífen)"})
	}
	if _, bad := reservedOrgSlugs[slug]; bad {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "reserved_slug", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Este identificador de organização é reservado"})
	}

	ctx := context.Background()
	taken, err := repo.SlugExists(ctx, slug)
	if err != nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "slug_check_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao verificar slug"})
	}
	if taken {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "slug_taken", ua)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Já existe uma organização com este slug"})
	}

	if _, err := repo.GetByEmail(ctx, email); err == nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "email_taken", ua)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Este e-mail já está registado"})
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "email_check_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao verificar e-mail"})
	}

	fullKey := repo.NormalizeLoginKey(local + "." + slug)
	if fullKey == "" {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "invalid_login", ua)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Utilizador inválido"})
	}
	if _, err := repo.GetByLoginKey(ctx, fullKey); err == nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "login_taken", ua)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Este login já existe"})
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "login_check_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao verificar login"})
	}

	orgID := repo.NewUUID()
	if err := repo.InsertOrganization(ctx, orgID, slug, orgName); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "slug_taken", ua)
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Slug já em uso"})
		}
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "org_create_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao criar organização"})
	}

	u := map[string]interface{}{
		"username":         fullKey,
		"role":             "admin",
		"name":             name,
		"email":            email,
		"phone":            "",
		"document":         "",
		"organizationId":   orgID,
		"mustChangePassword": false,
	}
	userJSON, err := json.Marshal(u)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "perfil inválido"})
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "hash"})
	}
	if err := repo.InsertUser(ctx, fullKey, string(hash), userJSON); err != nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "user_create_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao criar utilizador"})
	}

	row, err := repo.GetByLoginKey(ctx, fullKey)
	if err != nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "profile_load_error", ua)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao carregar perfil"})
	}
	token, err := adhubjwt.SignToken(fullKey, "admin", orgID)
	if err != nil {
		_, _, _ = repo.RecordAuthFailure(c.Context(), "register", ip, identifier, "jwt_unavailable", ua)
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "JWT indisponível"})
	}
	_ = repo.RecordAuthSuccess(c.Context(), "register", ip, identifier, ua)

	return c.JSON(fiber.Map{
		"token": token,
		"user":  json.RawMessage(row.UserJSON),
		"organization": fiber.Map{
			"id":          orgID,
			"slug":        slug,
			"displayName": orgName,
		},
	})
}
