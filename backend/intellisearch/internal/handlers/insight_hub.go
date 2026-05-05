package handlers

import (
	"context"
	"database/sql"
	"strings"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

func insightHubClaims(c *fiber.Ctx) (*adhubjwt.Claims, error) {
	v := c.Locals("adhub_claims")
	cl, ok := v.(*adhubjwt.Claims)
	if !ok || cl == nil {
		return nil, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Sessão inválida"})
	}
	return cl, nil
}

// InsightHubBootstrap GET — estado do módulo, limites e uso; cria workspace quando há direito ativo.
func InsightHubBootstrap(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	claims, err := insightHubClaims(c)
	if err != nil {
		return err
	}
	orgID := strings.TrimSpace(claims.OrgID)
	if orgID == "" {
		return c.JSON(fiber.Map{"active": false, "reason": "no_organization"})
	}

	ctx := context.Background()
	ent, err := repo.GetInsightHubEntitlement(ctx, orgID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(fiber.Map{"active": false, "reason": "no_entitlement"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao ler Insight Hub"})
	}
	if !repo.InsightHubEntitlementActive(ent.Status) {
		return c.JSON(fiber.Map{"active": false, "reason": "inactive", "status": ent.Status})
	}

	if err := repo.EnsureInsightHubWorkspace(ctx, orgID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao preparar workspace"})
	}

	ws, _ := repo.GetInsightHubWorkspace(ctx, orgID)
	brCount, _ := repo.CountInsightHubBrands(ctx, orgID)

	out := fiber.Map{
		"active": true,
		"tier":   ent.Tier,
		"limits": fiber.Map{
			"maxBrands":           ent.MaxBrands,
			"maxDashboards":       ent.MaxDashboards,
			"maxGuestUsers":       ent.MaxGuestUsers,
			"maxScheduledReports": ent.MaxScheduledReports,
			"aiAnalysis":          ent.FeatureAI,
			"competitorAnalysis":  ent.FeatureCompetitor,
			"groupReports":        ent.FeatureGroupReports,
			"clientPortal":        ent.FeatureClientPortal,
		},
		"usage": fiber.Map{
			"brands":     brCount,
			"dashboards": 0,
		},
	}
	if ws != nil {
		w := fiber.Map{}
		if ws.AgencyName != nil {
			w["agencyName"] = *ws.AgencyName
		}
		if ws.PortalSlug != nil {
			w["portalSlug"] = *ws.PortalSlug
		}
		out["workspace"] = w
	} else {
		out["workspace"] = fiber.Map{}
	}
	return c.JSON(out)
}

// InsightHubListBrands GET.
func InsightHubListBrands(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	claims, err := insightHubClaims(c)
	if err != nil {
		return err
	}
	orgID := strings.TrimSpace(claims.OrgID)
	if orgID == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem organização"})
	}
	ctx := context.Background()
	ent, err := repo.GetInsightHubEntitlement(ctx, orgID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Insight Hub não contratado"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao validar módulo"})
	}
	if !repo.InsightHubEntitlementActive(ent.Status) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Subscrição inativa"})
	}

	list, err := repo.ListInsightHubBrands(ctx, orgID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar marcas"})
	}
	return c.JSON(fiber.Map{"brands": list})
}

type insightHubCreateBrandBody struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// InsightHubCreateBrand POST — admin ou gestor com módulo (JWT org).
func InsightHubCreateBrand(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	claims, err := insightHubClaims(c)
	if err != nil {
		return err
	}
	orgID := strings.TrimSpace(claims.OrgID)
	if orgID == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem organização"})
	}

	var body insightHubCreateBrandBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nome obrigatório"})
	}

	ctx := context.Background()
	ent, err := repo.GetInsightHubEntitlement(ctx, orgID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Insight Hub não contratado"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao validar módulo"})
	}
	if !repo.InsightHubEntitlementActive(ent.Status) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Subscrição inativa"})
	}

	id := repo.NewUUID()
	if err := repo.InsertInsightHubBrand(ctx, orgID, id, name, body.Email); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "limite") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": msg})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao criar marca"})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "name": name})
}
