package middleware

import (
	"context"
	"database/sql"
	"strings"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

// InsightHubAccess armazena resultado da validação para handlers consultarem sem reler BD.
type InsightHubAccess struct {
	OrgID   string
	Tier    string
	Limits  repo.InsightHubEntitlement
}

// CheckInsightHubAccess valida JWT (RequireAdHubSession já correu), confirma direito ativo e expõe via locals.
func CheckInsightHubAccess(c *fiber.Ctx) error {
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

	ctx := context.Background()
	ent, err := repo.GetInsightHubEntitlement(ctx, orgID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":  "Insight Hub não contratado para esta organização",
				"code":   "no_entitlement",
				"action": "upgrade",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao validar módulo"})
	}
	if !repo.InsightHubEntitlementActive(ent.Status) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "Subscrição do Insight Hub inativa — regularize o pagamento",
			"code":   "inactive_subscription",
			"status": ent.Status,
			"action": "regularize_payment",
		})
	}

	c.Locals("insight_hub_access", &InsightHubAccess{
		OrgID:  orgID,
		Tier:   ent.Tier,
		Limits: *ent,
	})
	return c.Next()
}

// MustInsightHubAccess devolve dados validados pelo middleware (evita re-fetch).
// Em handlers protegidos por CheckInsightHubAccess, este nunca devolve nil.
func MustInsightHubAccess(c *fiber.Ctx) *InsightHubAccess {
	v := c.Locals("insight_hub_access")
	if v == nil {
		return nil
	}
	a, _ := v.(*InsightHubAccess)
	return a
}
