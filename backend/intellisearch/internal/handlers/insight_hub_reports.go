package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"norter/intellisearch/internal/middleware"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

type insightHubCreateReportBody struct {
	BrandID     string                 `json:"brandId"`
	Title       string                 `json:"title"`
	Definition  map[string]interface{} `json:"definition"`
	TemplateKey string                 `json:"templateKey,omitempty"`
}

// InsightHubCreateReport POST.
func InsightHubCreateReport(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	var body insightHubCreateReportBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Título obrigatório"})
	}
	if body.Definition == nil {
		body.Definition = map[string]interface{}{"widgets": []interface{}{}}
	}
	defBytes, _ := json.Marshal(body.Definition)
	id, err := repo.CreateInsightHubReport(c.Context(), access.OrgID, body.BrandID, title, string(defBytes), body.TemplateKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gravar relatório"})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "title": title})
}

// InsightHubListReports GET.
func InsightHubListReports(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	brandID := strings.TrimSpace(c.Query("brandId"))
	list, err := repo.ListInsightHubReports(c.Context(), access.OrgID, brandID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar relatórios"})
	}
	return c.JSON(fiber.Map{"reports": list})
}

// InsightHubGetReport GET — devolve definição completa.
func InsightHubGetReport(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id obrigatório"})
	}
	title, def, brand, tpl, err := repo.GetInsightHubReport(c.Context(), access.OrgID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Relatório não encontrado"})
	}
	var defObj map[string]interface{}
	if err := json.Unmarshal(def, &defObj); err != nil {
		defObj = map[string]interface{}{"widgets": []interface{}{}}
	}
	return c.JSON(fiber.Map{
		"id":          id,
		"title":       title,
		"definition":  defObj,
		"brandId":     brand,
		"templateKey": tpl,
	})
}

// InsightHubDeleteReport DELETE.
func InsightHubDeleteReport(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	id := strings.TrimSpace(c.Params("id"))
	if err := repo.DeleteInsightHubReport(c.Context(), access.OrgID, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao remover relatório"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

type insightHubScheduleBody struct {
	ReportID   string   `json:"reportId,omitempty"`
	CronExpr   string   `json:"cronExpr"`
	Timezone   string   `json:"timezone,omitempty"`
	Recipients []string `json:"recipients"`
	Enabled    bool     `json:"enabled"`
}

// InsightHubCreateScheduledReport POST.
func InsightHubCreateScheduledReport(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	if access.Limits.MaxScheduledReports == 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Plano não inclui agendamentos"})
	}
	var body insightHubScheduleBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if strings.TrimSpace(body.CronExpr) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cronExpr obrigatório"})
	}
	if len(body.Recipients) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pelo menos um destinatário"})
	}
	tz := strings.TrimSpace(body.Timezone)
	if tz == "" {
		tz = "America/Sao_Paulo"
	}
	rec, _ := json.Marshal(body.Recipients)
	next := time.Now().UTC().Add(24 * time.Hour)
	id, err := repo.CreateInsightHubScheduledReport(c.Context(), access.OrgID, body.ReportID, body.CronExpr, tz, string(rec), body.Enabled, &next)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gravar agendamento"})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

// InsightHubListScheduledReports GET.
func InsightHubListScheduledReports(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	list, err := repo.ListInsightHubScheduledReports(c.Context(), access.OrgID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar agendamentos"})
	}
	return c.JSON(fiber.Map{"schedules": list})
}
