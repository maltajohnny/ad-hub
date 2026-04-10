package handlers

import (
	"context"
	"errors"
	"time"

	"norter/intellisearch/internal/adplatformsvc"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

func persistDBOr503(c *fiber.Ctx) bool {
	if !db.Available() {
		_ = c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Base de dados não configurada. Defina MYSQL_DSN e execute migrations/001_ad_platform_oauth_mysql.sql",
		})
		return false
	}
	return true
}

// POST /api/ad-platform/persist/meta/oauth/finish — troca code, grava token na base, devolve contas (sem token ao cliente).
func PersistMetaOAuthFinish(c *fiber.Ctx) error {
	if !persistDBOr503(c) {
		return nil
	}
	var body struct {
		Code          string `json:"code"`
		RedirectURI   string `json:"redirect_uri"`
		OrgID         string `json:"org_id"`
		MediaClientID string `json:"media_client_id"`
		Platform      string `json:"platform"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.Code == "" || body.RedirectURI == "" || body.OrgID == "" || body.MediaClientID == "" || body.Platform == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code, redirect_uri, org_id, media_client_id e platform são obrigatórios"})
	}
	if body.Platform != "meta-ads" && body.Platform != "instagram-ads" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "platform deve ser meta-ads ou instagram-ads"})
	}
	access, expIn, err := adplatformsvc.ExchangeMetaUserToken(body.Code, body.RedirectURI)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	var exp *time.Time
	if expIn > 0 {
		t := time.Now().UTC().Add(time.Duration(expIn) * time.Second)
		exp = &t
	}
	ctx := context.Background()
	if err := repo.UpsertTokenAfterOAuth(ctx, db.DB, body.OrgID, body.MediaClientID, body.Platform, access, "", exp); err != nil {
		if errors.Is(err, repo.ErrInvalidPlatform) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	items, err := adplatformsvc.MetaAdAccountItems(access)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ad_accounts": items})
}

// POST /api/ad-platform/persist/tiktok/oauth/finish
func PersistTikTokOAuthFinish(c *fiber.Ctx) error {
	if !persistDBOr503(c) {
		return nil
	}
	var body struct {
		AuthCode      string `json:"auth_code"`
		OrgID         string `json:"org_id"`
		MediaClientID string `json:"media_client_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.AuthCode == "" || body.OrgID == "" || body.MediaClientID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "auth_code, org_id e media_client_id obrigatórios"})
	}
	access, refresh, expIn, err := adplatformsvc.ExchangeTikTokUserToken(body.AuthCode)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	var exp *time.Time
	if expIn > 0 {
		t := time.Now().UTC().Add(time.Duration(expIn) * time.Second)
		exp = &t
	}
	ctx := context.Background()
	if err := repo.UpsertTokenAfterOAuth(ctx, db.DB, body.OrgID, body.MediaClientID, "tiktok-ads", access, refresh, exp); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	items, err := adplatformsvc.TikTokAdAccountItems(access)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ad_accounts": items})
}

// POST /api/ad-platform/persist/link-and-sync — associa conta externa e grava métricas na base.
func PersistLinkAndSync(c *fiber.Ctx) error {
	if !persistDBOr503(c) {
		return nil
	}
	var body struct {
		OrgID                 string `json:"org_id"`
		MediaClientID         string `json:"media_client_id"`
		Platform              string `json:"platform"`
		ExternalAccountID     string `json:"external_account_id"`
		ExternalAccountLabel  string `json:"external_account_label"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.OrgID == "" || body.MediaClientID == "" || body.Platform == "" || body.ExternalAccountID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "campos obrigatórios em falta"})
	}
	ctx := context.Background()
	row, err := repo.GetToken(ctx, db.DB, body.OrgID, body.MediaClientID, body.Platform)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "token OAuth não encontrado — refaça o login"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	var m adplatformsvc.MetricsSummary
	switch body.Platform {
	case "meta-ads", "instagram-ads":
		m, err = adplatformsvc.MetaInsightsSummary(row.AccessToken, body.ExternalAccountID)
	case "tiktok-ads":
		m, err = adplatformsvc.TikTokInsightsSummary(row.AccessToken, body.ExternalAccountID)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "platform inválida"})
	}
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	label := body.ExternalAccountLabel
	if label == "" {
		label = body.ExternalAccountID
	}
	if err := repo.UpdateLinkAndMetrics(ctx, db.DB, body.OrgID, body.MediaClientID, body.Platform,
		body.ExternalAccountID, label, m.TotalSpend, m.ROI, m.CPA, m.Currency, m.SyncedAt); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"metrics": fiber.Map{
			"total_spend": m.TotalSpend,
			"roi":         m.ROI,
			"cpa":         m.CPA,
			"currency":    m.Currency,
			"synced_at":   m.SyncedAt,
		},
	})
}

// POST /api/ad-platform/persist/metrics/refresh — atualiza KPIs usando token e conta já guardados.
func PersistMetricsRefresh(c *fiber.Ctx) error {
	if !persistDBOr503(c) {
		return nil
	}
	var body struct {
		OrgID         string `json:"org_id"`
		MediaClientID string `json:"media_client_id"`
		Platform      string `json:"platform"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.OrgID == "" || body.MediaClientID == "" || body.Platform == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "org_id, media_client_id e platform obrigatórios"})
	}
	ctx := context.Background()
	row, err := repo.GetToken(ctx, db.DB, body.OrgID, body.MediaClientID, body.Platform)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "token não encontrado"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !row.ExternalAccountID.Valid || row.ExternalAccountID.String == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "conta externa não definida — use link-and-sync primeiro"})
	}
	ext := row.ExternalAccountID.String
	var m adplatformsvc.MetricsSummary
	switch body.Platform {
	case "meta-ads", "instagram-ads":
		m, err = adplatformsvc.MetaInsightsSummary(row.AccessToken, ext)
	case "tiktok-ads":
		m, err = adplatformsvc.TikTokInsightsSummary(row.AccessToken, ext)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "platform inválida"})
	}
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	if err := repo.UpdateMetricsOnly(ctx, db.DB, body.OrgID, body.MediaClientID, body.Platform,
		m.TotalSpend, m.ROI, m.CPA, m.Currency, m.SyncedAt); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"metrics": fiber.Map{
			"total_spend": m.TotalSpend,
			"roi":         m.ROI,
			"cpa":         m.CPA,
			"currency":    m.Currency,
			"synced_at":   m.SyncedAt,
		},
	})
}

// POST /api/ad-platform/persist/metrics/refresh-client — todas as plataformas persistidas; resposta agregada para o card.
func PersistMetricsRefreshClient(c *fiber.Ctx) error {
	if !persistDBOr503(c) {
		return nil
	}
	var body struct {
		OrgID         string `json:"org_id"`
		MediaClientID string `json:"media_client_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.OrgID == "" || body.MediaClientID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "org_id e media_client_id obrigatórios"})
	}
	ctx := context.Background()
	rows, err := repo.ListTokensForClient(ctx, db.DB, body.OrgID, body.MediaClientID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if len(rows) == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "nenhum token persistido para este cliente"})
	}
	var totalSpend, totalConv, sumRoiSpend float64
	var lastSync string
	currency := "USD"
	any := false
	for _, row := range rows {
		if !row.ExternalAccountID.Valid || row.ExternalAccountID.String == "" {
			continue
		}
		ext := row.ExternalAccountID.String
		var m adplatformsvc.MetricsSummary
		var ferr error
		switch row.Platform {
		case "meta-ads", "instagram-ads":
			m, ferr = adplatformsvc.MetaInsightsSummary(row.AccessToken, ext)
		case "tiktok-ads":
			m, ferr = adplatformsvc.TikTokInsightsSummary(row.AccessToken, ext)
		default:
			continue
		}
		if ferr != nil {
			continue
		}
		_ = repo.UpdateMetricsOnly(ctx, db.DB, body.OrgID, body.MediaClientID, row.Platform,
			m.TotalSpend, m.ROI, m.CPA, m.Currency, m.SyncedAt)
		totalSpend += m.TotalSpend
		totalConv += m.Conversions
		sumRoiSpend += m.ROI * m.TotalSpend
		lastSync = m.SyncedAt
		if m.Currency != "" {
			currency = m.Currency
		}
		any = true
	}
	if !any {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "nenhuma plataforma com conta externa definida — complete o vínculo antes",
		})
	}
	avgRoi := 0.0
	if totalSpend > 0 {
		avgRoi = sumRoiSpend / totalSpend
	}
	cpa := 0.0
	if totalConv > 0 {
		cpa = totalSpend / totalConv
	}
	if lastSync == "" {
		lastSync = time.Now().UTC().Format(time.RFC3339)
	}
	return c.JSON(fiber.Map{
		"metrics": fiber.Map{
			"total_spend": totalSpend,
			"conversions": totalConv,
			"roi":         avgRoi,
			"cpa":         cpa,
			"currency":    currency,
			"synced_at":   lastSync,
		},
	})
}
