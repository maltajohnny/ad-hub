package handlers

import (
	"strconv"
	"strings"
	"time"

	"norter/intellisearch/internal/middleware"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

// rangeFromLabel devolve from/to UTC para um label (7d, 14d, 30d, 90d, mtd, ytd) ou padrão 30d.
func rangeFromLabel(label string) (time.Time, time.Time, string) {
	now := time.Now().UTC()
	to := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, time.UTC)
	switch strings.TrimSpace(strings.ToLower(label)) {
	case "7d":
		return to.AddDate(0, 0, -6), to, "7d"
	case "14d":
		return to.AddDate(0, 0, -13), to, "14d"
	case "90d":
		return to.AddDate(0, 0, -89), to, "90d"
	case "mtd":
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC), to, "mtd"
	case "ytd":
		return time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC), to, "ytd"
	}
	return to.AddDate(0, 0, -29), to, "30d"
}

func parseRangeQuery(c *fiber.Ctx) (time.Time, time.Time, string) {
	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))
	if from != "" && to != "" {
		f, errF := time.Parse("2006-01-02", from)
		t, errT := time.Parse("2006-01-02", to)
		if errF == nil && errT == nil && !t.Before(f) {
			label := from + ".." + to
			return f.UTC(), time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, time.UTC), label
		}
	}
	return rangeFromLabel(c.Query("range"))
}

// InsightHubOverview GET — resumo agregado da marca (KPIs + séries simples).
func InsightHubOverview(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	brandID := strings.TrimSpace(c.Query("brandId"))
	if brandID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "brandId obrigatório"})
	}
	from, to, label := parseRangeQuery(c)

	keys := []string{
		"page_impressions", "page_impressions_unique", "page_post_engagements", "page_fans", "page_fan_adds",
		"ads_spend", "ads_impressions", "ads_clicks", "ads_reach",
	}

	totals, err := repo.SumMetricsByKeyForBrand(c.Context(), access.OrgID, brandID, from, to, keys)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao agregar métricas"})
	}

	series, err := repo.DailyMetricsForBrand(c.Context(), access.OrgID, brandID, from, to, []string{
		"page_impressions", "page_post_engagements", "ads_spend", "ads_clicks",
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao consultar séries"})
	}

	// Conexões ativas (para mostrar avisos do tipo "sem dados").
	conns, _ := repo.ListInsightHubConnections(c.Context(), access.OrgID, brandID)
	connectedProviders := []string{}
	for _, cn := range conns {
		if cn.Status == "connected" {
			connectedProviders = append(connectedProviders, cn.Provider)
		}
	}

	return c.JSON(fiber.Map{
		"brandId":            brandID,
		"range":              label,
		"from":               from.Format("2006-01-02"),
		"to":                 to.Format("2006-01-02"),
		"totals":             totals,
		"series":             series,
		"connectedProviders": connectedProviders,
	})
}

// InsightHubAggregateAccounts GET — comparativo de KPIs por marca dentro da org (ranking).
func InsightHubAggregateAccounts(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	from, to, label := parseRangeQuery(c)
	keysCSV := strings.TrimSpace(c.Query("keys"))
	keys := []string{"page_impressions", "page_post_engagements", "ads_spend"}
	if keysCSV != "" {
		var arr []string
		for _, k := range strings.Split(keysCSV, ",") {
			if v := strings.TrimSpace(k); v != "" {
				arr = append(arr, v)
			}
		}
		if len(arr) > 0 {
			keys = arr
		}
	}

	brands, err := repo.ListInsightHubBrands(c.Context(), access.OrgID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar marcas"})
	}
	type Row struct {
		BrandID string             `json:"brandId"`
		Name    string             `json:"name"`
		Totals  map[string]float64 `json:"totals"`
	}
	rows := make([]Row, 0, len(brands))
	for _, b := range brands {
		t, _ := repo.SumMetricsByKeyForBrand(c.Context(), access.OrgID, b.ID, from, to, keys)
		rows = append(rows, Row{BrandID: b.ID, Name: b.Name, Totals: t})
	}
	return c.JSON(fiber.Map{
		"range": label,
		"from":  from.Format("2006-01-02"),
		"to":    to.Format("2006-01-02"),
		"keys":  keys,
		"rows":  rows,
	})
}

// InsightHubListPosts GET — feed analítico de posts.
func InsightHubListPosts(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	brandID := strings.TrimSpace(c.Query("brandId"))
	if brandID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "brandId obrigatório"})
	}
	from, to, label := parseRangeQuery(c)
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
	offset, _ := strconv.Atoi(strings.TrimSpace(c.Query("offset")))
	posts, total, err := repo.ListInsightHubPosts(c.Context(), access.OrgID, brandID, from, to,
		c.Query("sortBy"), c.Query("sortDir"), limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar posts"})
	}
	return c.JSON(fiber.Map{
		"brandId": brandID,
		"range":   label,
		"from":    from.Format("2006-01-02"),
		"to":      to.Format("2006-01-02"),
		"posts":   posts,
		"total":   total,
	})
}
