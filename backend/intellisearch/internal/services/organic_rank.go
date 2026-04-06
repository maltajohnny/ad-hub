package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// NormalizeDomain extrai o host sem protocolo nem www.
func NormalizeDomain(d string) string {
	s := strings.TrimSpace(strings.ToLower(d))
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "www.")
	if i := strings.Index(s, "/"); i >= 0 {
		s = s[:i]
	}
	return s
}

// OrganicRankResult resultado da pesquisa orgânica Google (SerpAPI).
type OrganicRankResult struct {
	OK       bool    `json:"ok"`
	Demo     bool    `json:"demo,omitempty"`
	Message  string  `json:"message,omitempty"`
	Keyword  string  `json:"keyword"`
	Domain   string  `json:"domain"`
	Position *int    `json:"position"`
	Checked  int     `json:"checked"`
}

// OrganicRankOrError posição aproximada do domínio nos resultados orgânicos.
func OrganicRankOrError(keyword, domain string) (*OrganicRankResult, error) {
	keyword = strings.TrimSpace(keyword)
	domain = strings.TrimSpace(domain)
	if keyword == "" || domain == "" {
		return nil, fmt.Errorf("indique palavra-chave e domínio")
	}
	norm := NormalizeDomain(domain)

	key, err := serpAPIKey()
	if err != nil {
		return &OrganicRankResult{
			OK: true, Demo: true,
			Message: "Configure SERPAPI_KEY para posição real nos resultados orgânicos.",
			Keyword: keyword, Domain: norm, Position: nil, Checked: 0,
		}, nil
	}

	u := "https://serpapi.com/search.json?" + url.Values{
		"engine":   {"google"},
		"q":        {keyword},
		"api_key":  {key},
		"num":      {"100"},
	}.Encode()

	resp, err := http.Get(u)
	if err != nil {
		return nil, fmt.Errorf("requisição SerpAPI: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var data struct {
		OrganicResults []struct {
			Link     string `json:"link"`
			Position int    `json:"position"`
		} `json:"organic_results"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("JSON SerpAPI inválido: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("SerpAPI HTTP %d: %s", resp.StatusCode, string(body))
	}
	if data.Error != "" {
		return nil, fmt.Errorf("SerpAPI: %s", data.Error)
	}

	var position *int
	for i := range data.OrganicResults {
		link := strings.ToLower(data.OrganicResults[i].Link)
		if strings.Contains(link, norm) {
			p := data.OrganicResults[i].Position
			if p <= 0 {
				p = i + 1
			}
			position = &p
			break
		}
	}

	return &OrganicRankResult{
		OK: true, Keyword: keyword, Domain: norm, Position: position, Checked: len(data.OrganicResults),
	}, nil
}
