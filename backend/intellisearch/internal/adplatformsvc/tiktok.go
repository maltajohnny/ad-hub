package adplatformsvc

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// ExchangeTikTokUserToken troca auth_code por tokens.
func ExchangeTikTokUserToken(authCode string) (accessToken, refreshToken string, expiresIn int64, err error) {
	appID := strings.TrimSpace(os.Getenv("TIKTOK_APP_ID"))
	secret := strings.TrimSpace(os.Getenv("TIKTOK_APP_SECRET"))
	if appID == "" || secret == "" {
		return "", "", 0, fmt.Errorf("TIKTOK_APP_ID / TIKTOK_APP_SECRET em falta")
	}
	payload := map[string]string{
		"app_id":       appID,
		"secret":       secret,
		"auth_code":    strings.TrimSpace(authCode),
		"grant_type":   "authorization_code",
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", bytes.NewReader(b))
	if err != nil {
		return "", "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", 0, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", "", 0, fmt.Errorf("tiktok token: %s", string(raw))
	}
	var envelope struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return "", "", 0, err
	}
	if envelope.Code != 0 {
		return "", "", 0, fmt.Errorf("tiktok: %s", envelope.Message)
	}
	var data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}
	_ = json.Unmarshal(envelope.Data, &data)
	if data.AccessToken == "" {
		return "", "", 0, fmt.Errorf("tiktok sem access_token")
	}
	return data.AccessToken, data.RefreshToken, data.ExpiresIn, nil
}

// TikTokAdAccountItems anunciantes autorizados.
func TikTokAdAccountItems(accessToken string) ([]AdAccountItem, error) {
	req, err := http.NewRequest(http.MethodPost, "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Access-Token", accessToken)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
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
		return nil, fmt.Errorf("tiktok advertisers: %s", string(raw))
	}
	var data struct {
		List []struct {
			AdvertiserID   string `json:"advertiser_id"`
			AdvertiserName string `json:"advertiser_name"`
		} `json:"list"`
	}
	_ = json.Unmarshal(envelope.Data, &data)
	var out []AdAccountItem
	for _, x := range data.List {
		id := strings.TrimSpace(x.AdvertiserID)
		if id == "" {
			continue
		}
		out = append(out, AdAccountItem{ExternalID: id, Name: strings.TrimSpace(x.AdvertiserName)})
	}
	return out, nil
}

func parseTikTokNum(v interface{}) float64 {
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

// TikTokInsightsSummary relatório integrado básico (30 dias).
func TikTokInsightsSummary(accessToken, advertiserID string) (MetricsSummary, error) {
	id := strings.TrimSpace(advertiserID)
	if id == "" {
		return MetricsSummary{}, fmt.Errorf("advertiser_id vazio")
	}
	payload := map[string]interface{}{
		"advertiser_id": id,
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
		return MetricsSummary{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Access-Token", accessToken)
	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return MetricsSummary{}, err
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
		return MetricsSummary{}, fmt.Errorf("tiktok report: %s", envelope.Message)
	}
	var dataObj map[string]interface{}
	_ = json.Unmarshal(envelope.Data, &dataObj)
	spend := 0.0
	conv := 0.0
	if list, ok := dataObj["list"].([]interface{}); ok && len(list) > 0 {
		if row, ok := list[0].(map[string]interface{}); ok {
			if m, ok := row["metrics"].(map[string]interface{}); ok {
				spend = parseTikTokNum(m["spend"])
				conv = parseTikTokNum(m["conversion"])
				if conv == 0 {
					conv = parseTikTokNum(m["complete_payment"])
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
	return MetricsSummary{
		TotalSpend:   spend,
		Conversions:  conv,
		CPA:          cpa,
		ROI:          roi,
		Currency:     "USD",
		SyncedAt:     time.Now().UTC().Format(time.RFC3339),
		AdvertiserID: id,
	}, nil
}
