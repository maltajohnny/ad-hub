package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const googleOAuthTokenURL = "https://oauth2.googleapis.com/token"
const googleAdsOAuthScope = "https://www.googleapis.com/auth/adwords"

// GoogleAdsCustomerOption linha para UI — inclui loginCustomerId necessário para chamadas API (MCC).
type GoogleAdsCustomerOption struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Manager         bool   `json:"manager"`
	LoginCustomerID string `json:"loginCustomerId"`
	Hint            string `json:"hint,omitempty"` // "mcc" | "sub" | "leaf"
}

func googleAdsAPIVersion() string {
	v := strings.TrimSpace(os.Getenv("GOOGLE_ADS_API_VERSION"))
	if v == "" {
		return "v17"
	}
	if strings.HasPrefix(strings.ToLower(v), "v") {
		return v
	}
	return "v" + v
}

func googleAdsRESTBase() string {
	return "https://googleads.googleapis.com/" + googleAdsAPIVersion()
}

func googleAdsDeveloperToken() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_ADS_DEVELOPER_TOKEN"))
}

func googleAdsOAuthClientID() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_ADS_CLIENT_ID"))
}

func googleAdsOAuthSecret() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_ADS_CLIENT_SECRET"))
}

// BuildGoogleAdsAuthorizeURL OAuth Google com offline refresh para Google Ads API.
func BuildGoogleAdsAuthorizeURL(state, redirectURI string) (string, error) {
	cid := googleAdsOAuthClientID()
	if cid == "" {
		return "", fmt.Errorf("defina GOOGLE_ADS_CLIENT_ID")
	}
	if strings.TrimSpace(redirectURI) == "" {
		return "", fmt.Errorf("redirect_uri em falta")
	}
	u, err := url.Parse("https://accounts.google.com/o/oauth2/v2/auth")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("client_id", cid)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", googleAdsOAuthScope)
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	q.Set("state", state)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// ExchangeGoogleAdsOAuthCode troca code por refresh_token + access_token (opcional).
func ExchangeGoogleAdsOAuthCode(ctx context.Context, code, redirectURI string) (refreshToken, accessToken string, err error) {
	cid := googleAdsOAuthClientID()
	sec := googleAdsOAuthSecret()
	if cid == "" || sec == "" {
		return "", "", fmt.Errorf("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET em falta")
	}
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", cid)
	form.Set("client_secret", sec)
	form.Set("redirect_uri", redirectURI)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleOAuthTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", "", fmt.Errorf("token Google HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tok struct {
		RefreshToken string `json:"refresh_token"`
		AccessToken  string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", "", err
	}
	if strings.TrimSpace(tok.RefreshToken) == "" {
		return "", "", fmt.Errorf("Google não devolveu refresh_token — repita o fluxo com prompt=consent")
	}
	return tok.RefreshToken, tok.AccessToken, nil
}

func googleRefreshAccessToken(ctx context.Context, refreshToken string) (access string, err error) {
	cid := googleAdsOAuthClientID()
	sec := googleAdsOAuthSecret()
	form := url.Values{}
	form.Set("refresh_token", refreshToken)
	form.Set("client_id", cid)
	form.Set("client_secret", sec)
	form.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleOAuthTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("refresh Google HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", err
	}
	if strings.TrimSpace(tok.AccessToken) == "" {
		return "", fmt.Errorf("access_token vazio")
	}
	return tok.AccessToken, nil
}

func adsGET(ctx context.Context, path string, accessToken string, extra http.Header) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleAdsRESTBase()+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	dev := googleAdsDeveloperToken()
	if dev == "" {
		return nil, fmt.Errorf("GOOGLE_ADS_DEVELOPER_TOKEN em falta")
	}
	req.Header.Set("developer-token", dev)
	for k, vv := range extra {
		for _, v := range vv {
			req.Header.Add(k, v)
		}
	}

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Google Ads HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func adsPOSTSearch(ctx context.Context, customerID string, loginCustomerID string, query string, accessToken string) ([]byte, error) {
	bodyObj := map[string]string{"query": query}
	raw, err := json.Marshal(bodyObj)
	if err != nil {
		return nil, err
	}
	path := fmt.Sprintf("/customers/%s/googleAds:search", url.PathEscape(strings.TrimSpace(customerID)))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleAdsRESTBase()+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	dev := googleAdsDeveloperToken()
	if dev == "" {
		return nil, fmt.Errorf("GOOGLE_ADS_DEVELOPER_TOKEN em falta")
	}
	req.Header.Set("developer-token", dev)
	lc := strings.TrimSpace(loginCustomerID)
	if lc != "" {
		req.Header.Set("login-customer-id", lc)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Google Ads search HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

// ListAccessibleGoogleAdsCustomers lista contas acessíveis + clientes ligados a contas gestoras (MCC).
func ListAccessibleGoogleAdsCustomers(ctx context.Context, refreshToken string) ([]GoogleAdsCustomerOption, error) {
	access, err := googleRefreshAccessToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	body, err := adsGET(ctx, "/customers:listAccessibleCustomers", access, nil)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		ResourceNames []string `json:"resourceNames"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var out []GoogleAdsCustomerOption
	managers := []string{}

	for _, rn := range parsed.ResourceNames {
		id := strings.TrimPrefix(rn, "customers/")
		id = strings.ReplaceAll(id, "-", "")
		if id == "" || seen[id] {
			continue
		}
		name, isMgr, err := googleAdsDescribeCustomer(ctx, access, id, id)
		if err != nil {
			continue
		}
		seen[id] = true
		hint := "leaf"
		if isMgr {
			hint = "mcc"
			managers = append(managers, id)
		}
		out = append(out, GoogleAdsCustomerOption{
			ID: id, Name: name, Manager: isMgr, LoginCustomerID: id, Hint: hint,
		})
	}

	for _, mid := range managers {
		raw, err := adsPOSTSearch(ctx, mid, mid, `
SELECT
  customer_client.client_customer,
  customer_client.level,
  customer_client.manager,
  customer_client.descriptive_name,
  customer_client.id
FROM customer_client
WHERE customer_client.level <= 1`, access)
		if err != nil {
			continue
		}
		var envelope struct {
			Results []map[string]json.RawMessage `json:"results"`
		}
		if err := json.Unmarshal(raw, &envelope); err != nil {
			continue
		}
		for _, row := range envelope.Results {
			ccRaw, ok := row["customerClient"]
			if !ok {
				continue
			}
			var cc map[string]interface{}
			if err := json.Unmarshal(ccRaw, &cc); err != nil {
				continue
			}
			cid := ""
			if v, ok := cc["id"]; ok && v != nil {
				switch t := v.(type) {
				case string:
					cid = strings.ReplaceAll(strings.TrimPrefix(strings.TrimSpace(t), "customers/"), "-", "")
				case float64:
					cid = fmt.Sprintf("%.0f", t)
				}
			}
			if cid == "" {
				if s, ok := cc["clientCustomer"].(string); ok && s != "" {
					cid = strings.ReplaceAll(strings.TrimPrefix(strings.TrimSpace(s), "customers/"), "-", "")
				}
			}
			if cid == "" || seen[cid] {
				continue
			}
			seen[cid] = true
			nm := ""
			if s, ok := cc["descriptiveName"].(string); ok {
				nm = strings.TrimSpace(s)
			}
			if nm == "" {
				nm = "Conta " + cid
			}
			mgr := false
			if b, ok := cc["manager"].(bool); ok {
				mgr = b
			}
			out = append(out, GoogleAdsCustomerOption{
				ID:              cid,
				Name:            nm,
				Manager:         mgr,
				LoginCustomerID: mid,
				Hint:            "sub",
			})
		}
	}

	if len(out) == 0 {
		return nil, fmt.Errorf("nenhuma conta Google Ads acessível com este login — confirme access_level da developer token e permissões na MCC")
	}
	return out, nil
}

func googleAdsDescribeCustomer(ctx context.Context, accessToken, customerID, loginCustomerID string) (name string, manager bool, err error) {
	q := `SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1`
	raw, err := adsPOSTSearch(ctx, customerID, loginCustomerID, q, accessToken)
	if err != nil {
		return "", false, err
	}
	var env struct {
		Results []struct {
			Customer *struct {
				ID               json.RawMessage `json:"id"`
				DescriptiveName  string          `json:"descriptiveName"`
				Manager          bool            `json:"manager"`
			} `json:"customer"`
		} `json:"results"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		return "", false, err
	}
	if len(env.Results) == 0 || env.Results[0].Customer == nil {
		return "", false, fmt.Errorf("sem customer na resposta")
	}
	c := env.Results[0].Customer
	nm := strings.TrimSpace(c.DescriptiveName)
	if nm == "" {
		nm = "Conta " + customerID
	}
	return nm, c.Manager, nil
}

// GoogleAdsScopesJSON devolve JSON para scopes_json na conexão.
func GoogleAdsScopesJSON(loginCustomerID string) string {
	lc := strings.TrimSpace(loginCustomerID)
	if lc == "" {
		return ""
	}
	b, _ := json.Marshal(map[string]interface{}{
		"googleAds": map[string]string{"loginCustomerId": lc},
	})
	return string(b)
}

// ParseGoogleAdsLoginCustomer extrai login customer id do scopes_json guardado.
func ParseGoogleAdsLoginCustomer(scopesJSON string) string {
	scopesJSON = strings.TrimSpace(scopesJSON)
	if scopesJSON == "" {
		return ""
	}
	var wrap struct {
		GoogleAds struct {
			LoginCustomerID string `json:"loginCustomerId"`
		} `json:"googleAds"`
	}
	if json.Unmarshal([]byte(scopesJSON), &wrap) != nil {
		return ""
	}
	return strings.TrimSpace(wrap.GoogleAds.LoginCustomerID)
}

