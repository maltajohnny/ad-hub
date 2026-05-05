package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"norter/intellisearch/internal/repo"
)

// FBGraphVersion versão default do Graph API. Pode ser sobrescrita por env META_GRAPH_VERSION.
const FBGraphVersion = "v21.0"

func metaGraphVersion() string {
	if v := strings.TrimSpace(os.Getenv("META_GRAPH_VERSION")); v != "" {
		return v
	}
	return FBGraphVersion
}

func metaAppCreds() (id, secret string, err error) {
	id = strings.TrimSpace(os.Getenv("META_APP_ID"))
	secret = strings.TrimSpace(os.Getenv("META_APP_SECRET"))
	if id == "" || secret == "" {
		return "", "", errors.New("META_APP_ID/META_APP_SECRET em falta no servidor")
	}
	return id, secret, nil
}

// BuildMetaAuthorizeURL gera URL OAuth Meta com state seguro.
// scopes default cobrem páginas/Instagram + ads_read; podem ser ajustados via META_DEFAULT_SCOPES.
func BuildMetaAuthorizeURL(state, redirectURI string) (string, error) {
	id, _, err := metaAppCreds()
	if err != nil {
		return "", err
	}
	scopes := strings.TrimSpace(os.Getenv("META_DEFAULT_SCOPES"))
	if scopes == "" {
		scopes = "pages_read_engagement,pages_show_list,instagram_basic,instagram_manage_insights,ads_read"
	}
	q := url.Values{}
	q.Set("client_id", id)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	q.Set("response_type", "code")
	q.Set("scope", scopes)
	return fmt.Sprintf("https://www.facebook.com/%s/dialog/oauth?%s", metaGraphVersion(), q.Encode()), nil
}

// ExchangeCodeForToken troca o código por short-lived; em seguida estende para long-lived.
func ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (token string, expiresIn int64, err error) {
	id, secret, err := metaAppCreds()
	if err != nil {
		return "", 0, err
	}
	u := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
		metaGraphVersion(),
		url.QueryEscape(id), url.QueryEscape(redirectURI), url.QueryEscape(secret), url.QueryEscape(code),
	)
	tok, exp, err := getJSONToken(ctx, u)
	if err != nil {
		return "", 0, err
	}
	long, lExp, err := exchangeForLongLivedToken(ctx, tok)
	if err != nil {
		return tok, exp, nil
	}
	if lExp <= 0 {
		lExp = exp
	}
	return long, lExp, nil
}

func exchangeForLongLivedToken(ctx context.Context, shortToken string) (string, int64, error) {
	id, secret, err := metaAppCreds()
	if err != nil {
		return "", 0, err
	}
	u := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
		metaGraphVersion(),
		url.QueryEscape(id), url.QueryEscape(secret), url.QueryEscape(shortToken),
	)
	return getJSONToken(ctx, u)
}

func getJSONToken(ctx context.Context, u string) (string, int64, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	cli := &http.Client{Timeout: 25 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", 0, fmt.Errorf("meta token http %d: %s", resp.StatusCode, sanitizeMeta(string(raw)))
	}
	var p struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(raw, &p); err != nil || p.AccessToken == "" {
		return "", 0, fmt.Errorf("resposta Meta inválida")
	}
	return p.AccessToken, p.ExpiresIn, nil
}

// MetaPageRef item do listagem de páginas.
type MetaPageRef struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Category            string `json:"category,omitempty"`
	AccessToken         string `json:"access_token,omitempty"`
	InstagramBusinessID string `json:"instagramBusinessId,omitempty"`
}

// ListUserPages obtém páginas geridas pelo utilizador (com page tokens) + Instagram business id se ligado.
func ListUserPages(ctx context.Context, userToken string) ([]MetaPageRef, error) {
	v := url.Values{}
	v.Set("fields", "id,name,category,access_token,instagram_business_account{id}")
	v.Set("limit", "200")
	u := fmt.Sprintf("https://graph.facebook.com/%s/me/accounts?%s", metaGraphVersion(), v.Encode())
	raw, err := metaGet(ctx, u, userToken)
	if err != nil {
		return nil, err
	}
	var p struct {
		Data []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Category    string `json:"category"`
			AccessToken string `json:"access_token"`
			Instagram   struct {
				ID string `json:"id"`
			} `json:"instagram_business_account"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	out := make([]MetaPageRef, 0, len(p.Data))
	for _, d := range p.Data {
		out = append(out, MetaPageRef{
			ID:                  d.ID,
			Name:                d.Name,
			Category:            d.Category,
			AccessToken:         d.AccessToken,
			InstagramBusinessID: d.Instagram.ID,
		})
	}
	return out, nil
}

// MetaAdAccountRef listagem de ad accounts.
type MetaAdAccountRef struct {
	ID            string `json:"id"`
	AccountID     string `json:"account_id"`
	Name          string `json:"name,omitempty"`
	Currency      string `json:"currency,omitempty"`
	AccountStatus int    `json:"account_status,omitempty"`
}

// ListUserAdAccounts retorna ad accounts disponíveis ao utilizador.
func ListUserAdAccounts(ctx context.Context, userToken string) ([]MetaAdAccountRef, error) {
	u := fmt.Sprintf("https://graph.facebook.com/%s/me/adaccounts?fields=name,account_id,account_status,currency&limit=200", metaGraphVersion())
	raw, err := metaGet(ctx, u, userToken)
	if err != nil {
		return nil, err
	}
	var p struct {
		Data []MetaAdAccountRef `json:"data"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	return p.Data, nil
}

func metaGet(ctx context.Context, u, token string) ([]byte, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	cli := &http.Client{Timeout: 30 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("meta_rate_limited")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("meta http %d: %s", resp.StatusCode, sanitizeMeta(string(raw)))
	}
	return raw, nil
}

// sanitizeMeta evita que tokens ou cookies vazem no log.
func sanitizeMeta(s string) string {
	s = strings.ReplaceAll(s, "access_token", "[redacted]")
	if len(s) > 512 {
		s = s[:512] + "…"
	}
	return s
}

// MetaSyncOutcome sumário do que foi gravado.
type MetaSyncOutcome struct {
	HTTPCalls    int
	RowsIngested int
	NextRunIn    time.Duration
}

// SyncFacebookPage executa sync básica para uma página: KPIs diários (page impressions, reach, fan adds, post engagements) + posts recentes.
func SyncFacebookPage(ctx context.Context, orgID, brandID, connectionID, externalAccountID, pageToken string) (MetaSyncOutcome, error) {
	out := MetaSyncOutcome{NextRunIn: 6 * time.Hour}
	if strings.TrimSpace(pageToken) == "" || strings.TrimSpace(externalAccountID) == "" {
		return out, errors.New("page_token ou page_id em falta")
	}

	since := time.Now().UTC().AddDate(0, 0, -90)
	until := time.Now().UTC()

	// Insights diários da página.
	v := url.Values{}
	v.Set("metric", "page_impressions,page_impressions_unique,page_post_engagements,page_fans,page_fan_adds")
	v.Set("period", "day")
	v.Set("since", since.Format("2006-01-02"))
	v.Set("until", until.Format("2006-01-02"))
	v.Set("access_token", pageToken)
	insightsURL := fmt.Sprintf("https://graph.facebook.com/%s/%s/insights?%s", metaGraphVersion(), externalAccountID, v.Encode())
	raw, err := metaGet(ctx, insightsURL, "")
	out.HTTPCalls++
	if err != nil {
		return out, err
	}
	var ip struct {
		Data []struct {
			Name   string `json:"name"`
			Period string `json:"period"`
			Values []struct {
				Value   any    `json:"value"`
				EndTime string `json:"end_time"`
			} `json:"values"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &ip); err != nil {
		return out, fmt.Errorf("insights inválidos: %w", err)
	}
	points := map[string]map[string]float64{}
	for _, d := range ip.Data {
		key := d.Name
		for _, vv := range d.Values {
			date := strings.SplitN(strings.TrimSpace(vv.EndTime), "T", 2)[0]
			if date == "" {
				continue
			}
			val, ok := numericValue(vv.Value)
			if !ok {
				continue
			}
			if _, exists := points[date]; !exists {
				points[date] = map[string]float64{}
			}
			points[date][key] = val
		}
	}
	rows, err := repo.UpsertInsightHubMetricsDaily(ctx, orgID, brandID, connectionID, "facebook_insights", externalAccountID, points)
	if err != nil {
		return out, err
	}
	out.RowsIngested += rows

	// Posts recentes.
	pv := url.Values{}
	pv.Set("fields", "id,message,permalink_url,created_time,attachments{media_type,media,url},full_picture,insights.metric(post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total,post_clicks,post_video_views)")
	pv.Set("limit", "50")
	pv.Set("since", since.Format("2006-01-02"))
	pv.Set("access_token", pageToken)
	postsURL := fmt.Sprintf("https://graph.facebook.com/%s/%s/posts?%s", metaGraphVersion(), externalAccountID, pv.Encode())
	rawP, err := metaGet(ctx, postsURL, "")
	out.HTTPCalls++
	if err != nil {
		return out, err
	}
	var pp struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(rawP, &pp); err != nil {
		return out, fmt.Errorf("posts inválidos: %w", err)
	}
	for _, item := range pp.Data {
		post := buildFacebookPostInput(orgID, brandID, connectionID, externalAccountID, item)
		if _, err := repo.UpsertInsightHubPost(ctx, post); err != nil {
			return out, err
		}
		out.RowsIngested++
	}
	return out, nil
}

func numericValue(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	case int64:
		return float64(x), true
	case map[string]any:
		// summed values em breakdowns
		total := 0.0
		for _, vv := range x {
			if f, ok := numericValue(vv); ok {
				total += f
			}
		}
		return total, true
	default:
		return 0, false
	}
}

func buildFacebookPostInput(orgID, brandID, connectionID, externalAccountID string, item map[string]any) repo.InsightHubPostInput {
	in := repo.InsightHubPostInput{
		OrgID:             orgID,
		BrandID:           brandID,
		ConnectionID:      connectionID,
		Provider:          "facebook_insights",
		ExternalAccountID: externalAccountID,
		ExternalPostID:    asString(item["id"]),
		Permalink:         asString(item["permalink_url"]),
		Message:           asString(item["message"]),
		MediaURL:          asString(item["full_picture"]),
	}
	if att, ok := item["attachments"].(map[string]any); ok {
		if data, ok := att["data"].([]any); ok && len(data) > 0 {
			if first, ok := data[0].(map[string]any); ok {
				in.MediaType = asString(first["media_type"])
				if media, ok := first["media"].(map[string]any); ok {
					in.ThumbnailURL = asString(asMap(media["image"])["src"])
				}
			}
		}
	}
	if t, ok := item["created_time"].(string); ok && t != "" {
		if pt, err := time.Parse(time.RFC3339, t); err == nil {
			in.PublishedAt = &pt
		}
	}
	rawJSON, _ := json.Marshal(item)
	in.RawJSON = string(rawJSON)

	if ins, ok := item["insights"].(map[string]any); ok {
		if data, ok := ins["data"].([]any); ok {
			for _, d := range data {
				m, _ := d.(map[string]any)
				name := asString(m["name"])
				values, _ := m["values"].([]any)
				if len(values) == 0 {
					continue
				}
				v0, _ := values[0].(map[string]any)
				val, ok := numericValue(v0["value"])
				if !ok {
					continue
				}
				ival := int(val)
				switch name {
				case "post_impressions":
					in.Impressions = &ival
				case "post_impressions_unique":
					in.Reach = &ival
				case "post_engaged_users":
					in.Engagement = &ival
				case "post_reactions_by_type_total":
					in.Likes = &ival
				case "post_video_views":
					in.VideoViews = &ival
				}
			}
		}
	}
	return in
}

func asString(v any) string {
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

func asMap(v any) map[string]any {
	m, ok := v.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return m
}

// SyncMetaAdAccount busca insights last_30d do ad account (spend, impressions, clicks).
func SyncMetaAdAccount(ctx context.Context, orgID, brandID, connectionID, adAccountID, accessToken string) (MetaSyncOutcome, error) {
	out := MetaSyncOutcome{NextRunIn: 6 * time.Hour}
	if !strings.HasPrefix(adAccountID, "act_") {
		return out, errors.New("ad_account_id deve começar por act_")
	}
	q := url.Values{}
	q.Set("fields", "spend,impressions,clicks,actions,reach,date_start")
	q.Set("level", "account")
	q.Set("time_range", `{"since":"`+time.Now().AddDate(0, 0, -30).UTC().Format("2006-01-02")+`","until":"`+time.Now().UTC().Format("2006-01-02")+`"}`)
	q.Set("time_increment", "1")
	q.Set("access_token", accessToken)
	u := fmt.Sprintf("https://graph.facebook.com/%s/%s/insights?%s", metaGraphVersion(), adAccountID, q.Encode())
	raw, err := metaGet(ctx, u, "")
	out.HTTPCalls++
	if err != nil {
		return out, err
	}
	var p struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return out, fmt.Errorf("ads insights inválidos: %w", err)
	}
	points := map[string]map[string]float64{}
	for _, d := range p.Data {
		date := asString(d["date_start"])
		if date == "" {
			continue
		}
		if _, exists := points[date]; !exists {
			points[date] = map[string]float64{}
		}
		if v, ok := numericValue(d["spend"]); ok {
			points[date]["ads_spend"] = v
		}
		if v, ok := numericValue(d["impressions"]); ok {
			points[date]["ads_impressions"] = v
		}
		if v, ok := numericValue(d["clicks"]); ok {
			points[date]["ads_clicks"] = v
		}
		if v, ok := numericValue(d["reach"]); ok {
			points[date]["ads_reach"] = v
		}
	}
	rows, err := repo.UpsertInsightHubMetricsDaily(ctx, orgID, brandID, connectionID, "meta_ads", adAccountID, points)
	if err != nil {
		return out, err
	}
	out.RowsIngested += rows
	return out, nil
}
