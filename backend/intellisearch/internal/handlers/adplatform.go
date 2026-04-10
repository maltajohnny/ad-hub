package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const fbGraphVersion = "v21.0"

func bearerToken(c *fiber.Ctx) string {
	h := c.Get("Authorization")
	const p = "Bearer "
	if len(h) > len(p) && strings.EqualFold(h[:len(p)], p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}

// POST /api/ad-platform/meta/oauth/token — troca authorization code por access token (Graph API).
func MetaOAuthToken(c *fiber.Ctx) error {
	var body struct {
		Code        string `json:"code"`
		RedirectURI string `json:"redirect_uri"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.Code == "" || body.RedirectURI == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code e redirect_uri são obrigatórios"})
	}
	appID := strings.TrimSpace(os.Getenv("META_APP_ID"))
	secret := strings.TrimSpace(os.Getenv("META_APP_SECRET"))
	if appID == "" || secret == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Defina META_APP_ID e META_APP_SECRET no servidor (.env da API).",
		})
	}
	u := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
		fbGraphVersion,
		url.QueryEscape(appID),
		url.QueryEscape(body.RedirectURI),
		url.QueryEscape(secret),
		url.QueryEscape(body.Code),
	)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(raw)})
	}
	var out struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.AccessToken == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Resposta Meta inválida", "raw": string(raw)})
	}
	return c.JSON(out)
}

// GET /api/ad-platform/meta/adaccounts — lista contas de anúncio do utilizador (Bearer user token).
func MetaAdAccounts(c *fiber.Ctx) error {
	tok := bearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Cabeçalho Authorization: Bearer <token> obrigatório"})
	}
	graphURL := fmt.Sprintf("https://graph.facebook.com/%s/me/adaccounts?fields=name,account_id,account_status,currency", fbGraphVersion)
	req, err := http.NewRequest(http.MethodGet, graphURL, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(raw)})
	}
	return c.Type("json").Send(raw)
}

// GET /api/ad-platform/meta/insights?ad_account_id=act_xxx — agregado last_30d (spend, conversões estimadas).
func MetaInsights(c *fiber.Ctx) error {
	tok := bearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Bearer token obrigatório"})
	}
	act := strings.TrimSpace(c.Query("ad_account_id"))
	if act == "" || !strings.HasPrefix(act, "act_") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ad_account_id deve ser act_XXXXX"})
	}
	q := url.Values{}
	q.Set("fields", "spend,actions,impressions,clicks,account_currency")
	q.Set("date_preset", "last_30d")
	q.Set("level", "account")
	graphURL := fmt.Sprintf("https://graph.facebook.com/%s/%s/insights?%s", fbGraphVersion, act, q.Encode())
	req, err := http.NewRequest(http.MethodGet, graphURL, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(raw)})
	}

	var wrap struct {
		Data []struct {
			Spend            string                   `json:"spend"`
			Actions          []map[string]interface{} `json:"actions"`
			Impressions      string                   `json:"impressions"`
			Clicks           string                   `json:"clicks"`
			AccountCurrency  string                   `json:"account_currency"`
		} `json:"data"`
	}
	_ = json.Unmarshal(raw, &wrap)

	spend := 0.0
	conversions := 0.0
	currency := "USD"
	impressions := 0.0
	clicks := 0.0
	if len(wrap.Data) > 0 {
		row := wrap.Data[0]
		spend, _ = strconv.ParseFloat(row.Spend, 64)
		impressions, _ = strconv.ParseFloat(row.Impressions, 64)
		clicks, _ = strconv.ParseFloat(row.Clicks, 64)
		if row.AccountCurrency != "" {
			currency = row.AccountCurrency
		}
		for _, a := range row.Actions {
			at, _ := a["action_type"].(string)
			vStr, _ := a["value"].(string)
			val, _ := strconv.ParseFloat(vStr, 64)
			if val == 0 {
				if vf, ok := a["value"].(float64); ok {
					val = vf
				}
			}
			if strings.Contains(strings.ToLower(at), "purchase") ||
				strings.Contains(strings.ToLower(at), "lead") ||
				strings.Contains(strings.ToLower(at), "complete_registration") ||
				strings.Contains(strings.ToLower(at), "offsite_conversion") {
				conversions += val
			}
		}
	}
	cpa := 0.0
	if conversions > 0 {
		cpa = spend / conversions
	}
	revenue := conversions * 120
	roi := 0.0
	if spend > 0 {
		roi = (revenue - spend) / spend
	}

	return c.JSON(fiber.Map{
		"raw":           json.RawMessage(raw),
		"total_spend":   spend,
		"conversions":   conversions,
		"cpa":           cpa,
		"roi":           roi,
		"currency":      currency,
		"impressions":   impressions,
		"clicks":        clicks,
		"synced_at":     time.Now().UTC().Format(time.RFC3339),
		"date_preset":   "last_30d",
		"ad_account_id": act,
	})
}

// POST /api/ad-platform/tiktok/oauth/token — troca auth_code por access_token (Marketing API).
func TikTokOAuthToken(c *fiber.Ctx) error {
	var body struct {
		AuthCode string `json:"auth_code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if strings.TrimSpace(body.AuthCode) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "auth_code obrigatório"})
	}
	appID := strings.TrimSpace(os.Getenv("TIKTOK_APP_ID"))
	secret := strings.TrimSpace(os.Getenv("TIKTOK_APP_SECRET"))
	if appID == "" || secret == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Defina TIKTOK_APP_ID e TIKTOK_APP_SECRET no servidor.",
		})
	}
	payload := map[string]string{
		"app_id":       appID,
		"secret":       secret,
		"auth_code":    strings.TrimSpace(body.AuthCode),
		"grant_type":   "authorization_code",
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", bytes.NewReader(b))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(raw)})
	}
	var envelope struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Resposta TikTok inválida", "raw": string(raw)})
	}
	if envelope.Code != 0 {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": envelope.Message, "code": envelope.Code, "raw": string(raw)})
	}
	var data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}
	_ = json.Unmarshal(envelope.Data, &data)
	if data.AccessToken == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "access_token em falta", "raw": string(raw)})
	}
	return c.JSON(fiber.Map{
		"access_token":  data.AccessToken,
		"refresh_token": data.RefreshToken,
		"expires_in":    data.ExpiresIn,
	})
}

// GET /api/ad-platform/tiktok/advertisers — anunciantes autorizados (Access-Token header TikTok).
func TikTokAdvertisers(c *fiber.Ctx) error {
	tok := strings.TrimSpace(c.Get("Access-Token"))
	if tok == "" {
		tok = bearerToken(c)
	}
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Access-Token ou Authorization Bearer obrigatório"})
	}
	req, err := http.NewRequest(http.MethodPost, "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", bytes.NewReader([]byte("{}")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Access-Token", tok)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(raw)})
	}
	return c.Type("json").Send(raw)
}

// POST /api/ad-platform/tiktok/report/basic — relatório integrado simplificado (últimos 30 dias).
func TikTokBasicReport(c *fiber.Ctx) error {
	tok := strings.TrimSpace(c.Get("Access-Token"))
	if tok == "" {
		tok = bearerToken(c)
	}
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Access-Token ou Bearer obrigatório"})
	}
	var body struct {
		AdvertiserID string `json:"advertiser_id"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.AdvertiserID) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "advertiser_id obrigatório (JSON)"})
	}
	payload := map[string]interface{}{
		"advertiser_id": body.AdvertiserID,
		"service_type":  "AUCTION",
		"report_type":   "BASIC",
		"data_level":    "AUCTION_ADVERTISER",
		"dimensions":    []string{"advertiser_id"},
		"metrics":       []string{"spend", "conversion", "complete_payment"},
		"start_date":    time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02"),
		"end_date":      time.Now().UTC().Format("2006-01-02"),
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://business-api.tiktok.com/open_api/v1.3/reports/integrated/get/", bytes.NewReader(b))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Access-Token", tok)
	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var envelope struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	_ = json.Unmarshal(raw, &envelope)
	if resp.StatusCode >= 400 || envelope.Code != 0 {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":   envelope.Message,
			"code":    envelope.Code,
			"raw":     string(raw),
			"hint":    "Confirme permissões do app TikTok e formato de relatório na documentação atual.",
			"partial": true,
		})
	}

	spend := 0.0
	conv := 0.0
	var dataObj map[string]interface{}
	_ = json.Unmarshal(envelope.Data, &dataObj)
	if list, ok := dataObj["list"].([]interface{}); ok && len(list) > 0 {
		if row, ok := list[0].(map[string]interface{}); ok {
			if m, ok := row["metrics"].(map[string]interface{}); ok {
				spend = parseTikTokNumber(m["spend"])
				conv = parseTikTokNumber(m["conversion"])
				if conv == 0 {
					conv = parseTikTokNumber(m["complete_payment"])
				}
			}
		}
	}
	cpa := 0.0
	if conv > 0 {
		cpa = spend / conv
	}
	revenue := conv * 120
	roi := 0.0
	if spend > 0 {
		roi = (revenue - spend) / spend
	}
	return c.JSON(fiber.Map{
		"total_spend":    spend,
		"conversions":    conv,
		"cpa":            cpa,
		"roi":            roi,
		"currency":       "USD",
		"synced_at":      time.Now().UTC().Format(time.RFC3339),
		"advertiser_id":  body.AdvertiserID,
		"tiktok_raw":     json.RawMessage(raw),
	})
}

func parseTikTokNumber(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(t), 64)
		return f
	default:
		return 0
	}
}
