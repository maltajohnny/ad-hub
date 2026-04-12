package handlers

import (
	"context"
	"database/sql"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

// AdHubOrgSubscription GET /api/ad-hub/auth/organization/subscription — JWT; estado do plano para o dashboard.
func AdHubOrgSubscription(c *fiber.Ctx) error {
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
	if claims.OrgID == "" {
		return c.JSON(fiber.Map{
			"planSlug":           nil,
			"billingPeriod":      nil,
			"subscriptionStatus": "none",
			"gestorTeamSeats":    0,
		})
	}

	ctx := context.Background()
	row, err := repo.GetOrgSubscriptionBilling(ctx, claims.OrgID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(fiber.Map{
				"planSlug":           nil,
				"billingPeriod":      nil,
				"subscriptionStatus": "none",
				"gestorTeamSeats":    0,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao ler organização"})
	}

	out := fiber.Map{
		"subscriptionStatus": row.SubscriptionStatus,
		"gestorTeamSeats":    row.GestorTeamSeats,
	}
	if row.PlanSlug.Valid {
		out["planSlug"] = row.PlanSlug.String
	} else {
		out["planSlug"] = nil
	}
	if row.BillingPeriod.Valid {
		out["billingPeriod"] = row.BillingPeriod.String
	} else {
		out["billingPeriod"] = nil
	}
	if row.AsaasCustomerID.Valid {
		out["asaasCustomerId"] = row.AsaasCustomerID.String
	}
	return c.JSON(out)
}
