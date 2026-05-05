package handlers

import (
	"strconv"
	"strings"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

// AdHubBillingInvoices GET — lista faturas + pendentes (Meu Plano).
func AdHubBillingInvoices(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	v := c.Locals("adhub_claims")
	cl, ok := v.(*adhubjwt.Claims)
	if !ok || cl == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sessão inválida"})
	}
	orgID := strings.TrimSpace(cl.OrgID)
	if orgID == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem organização"})
	}
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))

	list, err := repo.ListBillingInvoices(c.Context(), orgID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar faturas"})
	}
	pending, _ := repo.CountPendingInvoices(c.Context(), orgID)
	return c.JSON(fiber.Map{
		"invoices":      list,
		"pendingCount":  pending,
	})
}
