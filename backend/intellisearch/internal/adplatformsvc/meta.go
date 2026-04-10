package adplatformsvc

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const fbGraphVersion = "v21.0"

// AdAccountItem conta de anúncios Meta.
type AdAccountItem struct {
	ExternalID string `json:"external_id"`
	Name       string `json:"name"`
}

// MetricsSummary KPIs agregados (últimos 30 dias conta).
type MetricsSummary struct {
	TotalSpend   float64 `json:"total_spend"`
	Conversions  float64 `json:"conversions"`
	CPA          float64 `json:"cpa"`
	ROI          float64 `json:"roi"`
	Currency     string  `json:"currency"`
	SyncedAt     string  `json:"synced_at"`
	Impressions  float64 `json:"impressions"`
	Clicks       float64 `json:"clicks"`
	AdAccountID  string  `json:"ad_account_id,omitempty"`
	AdvertiserID string  `json:"advertiser_id,omitempty"`
}

// ExchangeMetaUserToken troca code por access token utilizador.
func ExchangeMetaUserToken(code, redirectURI string) (accessToken string, expiresIn int64, err error) {
	appID := strings.TrimSpace(os.Getenv("META_APP_ID"))
	secret := strings.TrimSpace(os.Getenv("META_APP_SECRET"))
	if appID == "" || secret == "" {
		return "", 0, fmt.Errorf("META_APP_ID / META_APP_SECRET em falta")
	}
	u := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
		fbGraphVersion,
		url.QueryEscape(appID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(secret),
		url.QueryEscape(code),
	)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", 0, fmt.Errorf("meta token: %s", string(raw))
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.AccessToken == "" {
		return "", 0, fmt.Errorf("resposta Meta inválida: %s", string(raw))
	}
	return out.AccessToken, out.ExpiresIn, nil
}

// MetaAdAccountItems lista contas act_xxx.
func MetaAdAccountItems(accessToken string) ([]AdAccountItem, error) {
	graphURL := fmt.Sprintf("https://graph.facebook.com/%s/me/adaccounts?fields=name,account_id", fbGraphVersion)
	req, err := http.NewRequest(http.MethodGet, graphURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("meta adaccounts: %s", string(raw))
	}
	var wrap struct {
		Data []struct {
			Name      string `json:"name"`
			AccountID string `json:"account_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return nil, err
	}
	var out []AdAccountItem
	for _, r := range wrap.Data {
		id := strings.TrimSpace(r.AccountID)
		if id == "" {
			continue
		}
		ext := id
		if !strings.HasPrefix(ext, "act_") {
			ext = "act_" + ext
		}
		out = append(out, AdAccountItem{ExternalID: ext, Name: strings.TrimSpace(r.Name)})
	}
	return out, nil
}

// MetaInsightsSummary insights nível conta last_30d.
func MetaInsightsSummary(accessToken, actID string) (MetricsSummary, error) {
	act := strings.TrimSpace(actID)
	if act == "" || !strings.HasPrefix(act, "act_") {
		return MetricsSummary{}, fmt.Errorf("ad_account_id inválido")
	}
	q := url.Values{}
	q.Set("fields", "spend,actions,impressions,clicks,account_currency")
	q.Set("date_preset", "last_30d")
	q.Set("level", "account")
	graphURL := fmt.Sprintf("https://graph.facebook.com/%s/%s/insights?%s", fbGraphVersion, act, q.Encode())
	req, err := http.NewRequest(http.MethodGet, graphURL, nil)
	if err != nil {
		return MetricsSummary{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return MetricsSummary{}, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return MetricsSummary{}, fmt.Errorf("meta insights: %s", string(raw))
	}
	var wrap struct {
		Data []struct {
			Spend           string                   `json:"spend"`
			Actions         []map[string]interface{} `json:"actions"`
			Impressions     string                   `json:"impressions"`
			Clicks          string                   `json:"clicks"`
			AccountCurrency string                   `json:"account_currency"`
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
			lt := strings.ToLower(at)
			if strings.Contains(lt, "purchase") || strings.Contains(lt, "lead") ||
				strings.Contains(lt, "complete_registration") || strings.Contains(lt, "offsite_conversion") {
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
	return MetricsSummary{
		TotalSpend:  spend,
		Conversions: conversions,
		CPA:         cpa,
		ROI:         roi,
		Currency:    currency,
		SyncedAt:    time.Now().UTC().Format(time.RFC3339),
		Impressions: impressions,
		Clicks:      clicks,
		AdAccountID: act,
	}, nil
}
