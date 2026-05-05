package middleware

import (
	"strings"

	adhubjwt "norter/intellisearch/internal/auth"

	"github.com/gofiber/fiber/v2"
)

// RequireAdHubSession garante JWT válido e organization_id (qualquer role).
func RequireAdHubSession(c *fiber.Ctx) error {
	h := c.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	token := strings.TrimSpace(h[7:])
	claims, err := adhubjwt.ParseToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}
	if strings.TrimSpace(claims.OrgID) == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Organização em falta no token"})
	}
	c.Locals("adhub_claims", claims)
	return c.Next()
}

// RequireAdHubAdmin garante JWT válido com role=admin.
func RequireAdHubAdmin(c *fiber.Ctx) error {
	h := c.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	token := strings.TrimSpace(h[7:])
	claims, err := adhubjwt.ParseToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}
	if claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem permissão"})
	}
	c.Locals("adhub_claims", claims)
	return c.Next()
}
