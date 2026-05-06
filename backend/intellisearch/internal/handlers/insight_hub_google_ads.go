package handlers

import (
	"context"
	"encoding/json"
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
	connID, returnPath, err := finalizeGoogleAdsOAuth(context.Background(), state, code)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error="+url.QueryEscape(err.Error()))
	}

	target := "/clientes/insight-hub/marcas?ih_connected=" + url.QueryEscape(connID)
	if returnPath != "" {
		target = returnPath
		sep := "?"
		if strings.Contains(target, "?") {
			sep = "&"
		}
		target += sep + "ih_connected=" + url.QueryEscape(connID)
	}
	return redirectWithMsg(c, target)
}

// InsightHubGoogleAdsFinish POST — endpoint interno para bridge OAuth (Cloudflare Worker).
func InsightHubGoogleAdsFinish(c *fiber.Ctx) error {
	sharedSecret := strings.TrimSpace(os.Getenv("INSIGHT_HUB_OAUTH_CALLBACK_SHARED_SECRET"))
	if sharedSecret == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "INSIGHT_HUB_OAUTH_CALLBACK_SHARED_SECRET não definido"})
	}
	if strings.TrimSpace(c.Get("X-Callback-Secret")) != sharedSecret {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	var body struct {
		State string `json:"state"`
		Code  string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	state := strings.TrimSpace(body.State)
	code := strings.TrimSpace(body.Code)
	if state == "" || code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing state/code"})
	}
	connID, returnPath, err := finalizeGoogleAdsOAuth(c.Context(), state, code)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"ok":         true,
		"connection": connID,
		"returnPath": returnPath,
	})
}

func finalizeGoogleAdsOAuth(ctx context.Context, state, code string) (connID string, returnPath string, err error) {
	st, err := repo.ConsumeOAuthState(ctx, state)
	if err != nil {
		return "", "", &insightHubErr{msg: "invalid_state"}
	}
	if strings.TrimSpace(st.Provider) != "google_ads" {
		return "", "", &insightHubErr{msg: "wrong_provider"}
	}

	refresh, _, err := services.ExchangeGoogleAdsOAuthCode(ctx, code, st.RedirectURI)
	if err != nil {
		return "", "", &insightHubErr{msg: "google_token_failed"}
	}

	tokenRef, err := repo.SaveInsightHubSecret(ctx, st.OrgID, &st.BrandID, []byte(refresh), nil)
	if err != nil {
		return "", "", &insightHubErr{msg: "secret_save_failed"}
	}

	connID, err = repo.UpsertInsightHubConnection(ctx, st.OrgID, st.BrandID, "google_ads", "", "Google Ads — pendente seleção", tokenRef, "", "connected")
	if err != nil {
		return "", "", &insightHubErr{msg: "connection_save_failed"}
	}
	_ = repo.EnsureInsightHubSyncState(ctx, st.OrgID, st.BrandID, connID, 1*time.Minute)
	metadata, _ := json.Marshal(fiber.Map{"provider": "google_ads", "channel": "bridge_or_callback"})
	repo.WriteAuditLog(ctx, st.OrgID, "", "insight_hub.oauth.callback", "connection", connID, string(metadata))
	return connID, st.ReturnPath, nil
}
