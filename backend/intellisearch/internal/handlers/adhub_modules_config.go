package handlers

import (
	"context"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

// AdHubPlatformModulesConfig GET/PUT /api/ad-hub/auth/platform/modules-config.
// GET: qualquer admin autenticado pode visualizar.
// PUT: apenas operador da plataforma (admin/qtrafficadmin) pode editar.
func AdHubPlatformModulesConfig(c *fiber.Ctx) error {
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
	if claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Apenas administradores podem aceder"})
	}

	ctx := context.Background()

	switch c.Method() {
	case fiber.MethodGet:
		cfg, err := repo.GetPlatformAdsAPIKeysConfig(ctx, db.DB)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao ler configuração"})
		}
		return c.JSON(cfg)
	case fiber.MethodPut:
		if !isPlatformOperatorLogin(claims.Subject) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Apenas admin da plataforma pode editar"})
		}
		var body repo.AdsAPIKeysConfig
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
		}
		if err := repo.UpsertPlatformAdsAPIKeysConfig(ctx, db.DB, body); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao guardar configuração"})
		}
		return c.JSON(fiber.Map{"ok": true})
	default:
		return c.SendStatus(fiber.StatusMethodNotAllowed)
	}
}
