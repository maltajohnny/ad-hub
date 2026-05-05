package handlers

import (
	"context"
	"net/url"
	"os"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/middleware"
	"norter/intellisearch/internal/repo"
	"norter/intellisearch/internal/services"

	"github.com/gofiber/fiber/v2"
)

// InsightHubGoogleAdsAuthorize POST — inicia OAuth Google (Ads API).
func InsightHubGoogleAdsAuthorize(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso ao Insight Hub"})
	}

	var body struct {
		BrandID     string `json:"brandId"`
		ReturnPath  string `json:"returnPath"`
		RedirectURI string `json:"redirectUri"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	brandID := strings.TrimSpace(body.BrandID)
	if brandID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "brandId obrigatório"})
	}

	redirect := strings.TrimSpace(body.RedirectURI)
	if redirect == "" {
		redirect = strings.TrimSpace(os.Getenv("INSIGHT_HUB_GOOGLE_ADS_REDIRECT_URI"))
	}
	if redirect == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Defina INSIGHT_HUB_GOOGLE_ADS_REDIRECT_URI no .env ou envie redirectUri no payload.",
		})
	}

	if err := ensureBrandBelongsToOrg(c.Context(), access.OrgID, brandID); err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	state, err := repo.NewOAuthState(c.Context(), access.OrgID, brandID, "google_ads", body.ReturnPath, redirect, 30*time.Minute)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Não foi possível iniciar OAuth"})
	}

	authorizeURL, err := services.BuildGoogleAdsAuthorizeURL(state, redirect)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": err.Error()})
	}
	repo.WriteAuditLog(c.Context(), access.OrgID, "", "insight_hub.oauth.start", "brand", brandID, `{"provider":"google_ads"}`)
	return c.JSON(fiber.Map{"state": state, "authorizeUrl": authorizeURL})
}

// InsightHubGoogleAdsCallback GET — callback público Google OAuth.
func InsightHubGoogleAdsCallback(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).SendString("MySQL indisponível")
	}
	state := strings.TrimSpace(c.Query("state"))
	code := strings.TrimSpace(c.Query("code"))
	errParam := strings.TrimSpace(c.Query("error"))
	if errParam != "" {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error="+url.QueryEscape(errParam))
	}
	if state == "" || code == "" {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=missing_state")
	}

	ctx := context.Background()
	st, err := repo.ConsumeOAuthState(ctx, state)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=invalid_state")
	}
	if strings.TrimSpace(st.Provider) != "google_ads" {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=wrong_provider")
	}

	refresh, _, err := services.ExchangeGoogleAdsOAuthCode(ctx, code, st.RedirectURI)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error="+url.QueryEscape("google_token_failed"))
	}

	tokenRef, err := repo.SaveInsightHubSecret(ctx, st.OrgID, &st.BrandID, []byte(refresh), nil)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=secret_save_failed")
	}

	connID, err := repo.UpsertInsightHubConnection(ctx, st.OrgID, st.BrandID, "google_ads", "", "Google Ads — pendente seleção", tokenRef, "", "connected")
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=connection_save_failed")
	}
	_ = repo.EnsureInsightHubSyncState(ctx, st.OrgID, st.BrandID, connID, 1*time.Minute)

	repo.WriteAuditLog(ctx, st.OrgID, "", "insight_hub.oauth.callback", "connection", connID, `{"provider":"google_ads"}`)

	target := "/clientes/insight-hub/marcas?ih_connected=" + url.QueryEscape(connID)
	if st.ReturnPath != "" {
		target = st.ReturnPath
		sep := "?"
		if strings.Contains(target, "?") {
			sep = "&"
		}
		target += sep + "ih_connected=" + url.QueryEscape(connID)
	}
	return redirectWithMsg(c, target)
}
