package asaas

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// BaseURL ex.: https://api.asaas.com/v3
func BaseURL() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("ASAAS_BASE_URL")), "/")
}

// Token env ASAAS_API_ (nome definido no projeto).
func Token() string {
	return strings.TrimSpace(os.Getenv("ASAAS_API_"))
}

func joinURL(path string) string {
	b := BaseURL()
	if b == "" {
		return ""
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return b + path
}

// PostJSON chama a API Asaas (POST JSON).
func PostJSON(path string, body interface{}) ([]byte, int, error) {
	tok := Token()
	bu := BaseURL()
	if tok == "" || bu == "" {
		return nil, 0, fmt.Errorf("defina ASAAS_API_ e ASAAS_BASE_URL")
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequest(http.MethodPost, joinURL(path), bytes.NewReader(raw))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("access_token", tok)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	out, rerr := io.ReadAll(resp.Body)
	return out, resp.StatusCode, rerr
}
