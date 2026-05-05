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

// InsightHubMetaAuthorize POST inicia OAuth Meta para uma marca; devolve URL para front redirecionar.
func InsightHubMetaAuthorize(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso ao Insight Hub"})
	}

	var body struct {
		BrandID     string `json:"brandId"`
		Provider    string `json:"provider"`
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
	provider := strings.TrimSpace(strings.ToLower(body.Provider))
	if provider == "" {
		provider = "facebook_insights"
	}
	allowed := map[string]bool{"facebook_insights": true, "meta_ads": true, "instagram": true}
	if !allowed[provider] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "provider não suportado"})
	}

	redirect := strings.TrimSpace(body.RedirectURI)
	if redirect == "" {
		redirect = strings.TrimSpace(os.Getenv("INSIGHT_HUB_META_REDIRECT_URI"))
	}
	if redirect == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Defina INSIGHT_HUB_META_REDIRECT_URI no .env ou envie redirectUri no payload.",
		})
	}

	if err := ensureBrandBelongsToOrg(c.Context(), access.OrgID, brandID); err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	state, err := repo.NewOAuthState(c.Context(), access.OrgID, brandID, provider, body.ReturnPath, redirect, 30*time.Minute)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Não foi possível iniciar OAuth"})
	}

	authorizeURL, err := services.BuildMetaAuthorizeURL(state, redirect)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": err.Error()})
	}
	repo.WriteAuditLog(c.Context(), access.OrgID, "", "insight_hub.oauth.start", "brand", brandID, `{"provider":"`+provider+`"}`)
	return c.JSON(fiber.Map{"state": state, "authorizeUrl": authorizeURL})
}

// InsightHubMetaCallback GET — usado pelo Meta após login. Cria conexão por marca.
func InsightHubMetaCallback(c *fiber.Ctx) error {
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
	token, exp, err := services.ExchangeCodeForToken(ctx, code, st.RedirectURI)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error="+url.QueryEscape("token_exchange_failed"))
	}
	var expPtr *time.Time
	if exp > 0 {
		t := time.Now().Add(time.Duration(exp) * time.Second)
		expPtr = &t
	}
	tokenRef, err := repo.SaveInsightHubSecret(ctx, st.OrgID, &st.BrandID, []byte(token), expPtr)
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=secret_save_failed")
	}

	connID, err := repo.UpsertInsightHubConnection(ctx, st.OrgID, st.BrandID, st.Provider, "", "Meta — pendente seleção", tokenRef, "[]", "connected")
	if err != nil {
		return redirectWithMsg(c, "/clientes/insight-hub/marcas?ih_error=connection_save_failed")
	}
	if err := repo.EnsureInsightHubSyncState(ctx, st.OrgID, st.BrandID, connID, 1*time.Minute); err != nil {
		// não bloqueia
	}
	repo.WriteAuditLog(ctx, st.OrgID, "", "insight_hub.oauth.callback", "connection", connID, `{"provider":"`+st.Provider+`"}`)

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

func redirectWithMsg(c *fiber.Ctx, target string) error {
	return c.Redirect(target, fiber.StatusFound)
}

// InsightHubListConnections GET — devolve conexões da org (filtra por brand opcional).
func InsightHubListConnections(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	brandID := strings.TrimSpace(c.Query("brandId"))
	list, err := repo.ListInsightHubConnections(c.Context(), access.OrgID, brandID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar conexões"})
	}
	return c.JSON(fiber.Map{"connections": list})
}

// InsightHubDeleteConnection DELETE — revoga conexão (e secret).
func InsightHubDeleteConnection(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id obrigatório"})
	}
	if err := repo.DeleteInsightHubConnection(c.Context(), access.OrgID, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao remover conexão"})
	}
	repo.WriteAuditLog(c.Context(), access.OrgID, "", "insight_hub.connection.delete", "connection", id, "")
	return c.JSON(fiber.Map{"ok": true})
}

// InsightHubMetaSelectAccount POST — escolhe a conta/página específica para a conexão (gravar external_account_id e display_label).
func InsightHubMetaSelectAccount(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id obrigatório"})
	}
	var body struct {
		ExternalAccountID string `json:"externalAccountId"`
		DisplayLabel      string `json:"displayLabel"`
		PageAccessToken   string `json:"pageAccessToken,omitempty"` // se for página, salvar token específico
		LoginCustomerID   string `json:"loginCustomerId,omitempty"` // Google Ads MCC — cabeçalho login-customer-id
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	ctx := c.Context()
	brandID, provider, tokenRef, err := repo.GetInsightHubConnectionTokenRef(ctx, access.OrgID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Conexão não encontrada"})
	}
	// Se é página, substituir o secret pelo page token (mais estável e com escopo correto).
	finalTokenRef := tokenRef
	if strings.TrimSpace(body.PageAccessToken) != "" {
		newRef, errTok := repo.SaveInsightHubSecret(ctx, access.OrgID, &brandID, []byte(strings.TrimSpace(body.PageAccessToken)), nil)
		if errTok == nil {
			finalTokenRef = newRef
			if tokenRef != "" {
				_ = repo.DeleteInsightHubSecret(ctx, access.OrgID, tokenRef)
			}
		}
	}
	scopesJSON := ""
	if strings.TrimSpace(provider) == "google_ads" {
		lc := strings.TrimSpace(body.LoginCustomerID)
		if lc == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "loginCustomerId obrigatório para Google Ads (conta MCC ou a própria conta)"})
		}
		scopesJSON = services.GoogleAdsScopesJSON(lc)
	}
	if _, err := repo.UpsertInsightHubConnection(ctx, access.OrgID, brandID, provider, body.ExternalAccountID, body.DisplayLabel, finalTokenRef, scopesJSON, "connected"); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao guardar seleção"})
	}
	if err := repo.EnsureInsightHubSyncState(ctx, access.OrgID, brandID, id, 30*time.Second); err != nil {
		// non fatal
	}
	return c.JSON(fiber.Map{"ok": true})
}

// InsightHubMetaListAvailable GET — lista páginas/ad accounts com o token guardado.
func InsightHubMetaListAvailable(c *fiber.Ctx) error {
	access := middleware.MustInsightHubAccess(c)
	if access == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Sem acesso"})
	}
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id obrigatório"})
	}
	ctx := c.Context()
	_, provider, tokenRef, err := repo.GetInsightHubConnectionTokenRef(ctx, access.OrgID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Conexão não encontrada"})
	}
	if tokenRef == "" {
		return c.Status(fiber.StatusFailedDependency).JSON(fiber.Map{"error": "Sem token guardado"})
	}
	plain, err := repo.GetInsightHubSecret(ctx, access.OrgID, tokenRef)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao ler token"})
	}
	token := strings.TrimSpace(string(plain))

	switch provider {
	case "facebook_insights", "instagram":
		pages, err := services.ListUserPages(ctx, token)
		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"pages": pages})
	case "meta_ads":
		accs, err := services.ListUserAdAccounts(ctx, token)
		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"adAccounts": accs})
	case "google_ads":
		accs, err := services.ListAccessibleGoogleAdsCustomers(ctx, token)
		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"googleAdsAccounts": accs})
	}
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "provider não suportado"})
}

func ensureBrandBelongsToOrg(ctx context.Context, orgID, brandID string) error {
	if db.DB == nil {
		return errInsightHubMySQLDown
	}
	var n int
	if err := db.DB.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM insight_hub_brands WHERE id = ? AND organization_id = ?`,
		brandID, orgID,
	).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		return errInsightHubBrandNotInOrg
	}
	return nil
}

type insightHubErr struct{ msg string }

func (e *insightHubErr) Error() string { return e.msg }

var (
	errInsightHubMySQLDown      = &insightHubErr{msg: "MySQL indisponível"}
	errInsightHubBrandNotInOrg  = &insightHubErr{msg: "Marca não pertence a esta organização"}
)
