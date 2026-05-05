package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"norter/intellisearch/internal/models"
)

const serpBase = "https://serpapi.com/search.json"

func serpAPIKey() (string, error) {
	k := os.Getenv("SERPAPI_KEY")
	if k == "" {
		return "", fmt.Errorf(
			"SERPAPI_KEY ausente: obtenha uma chave em https://serpapi.com e adicione a linha SERPAPI_KEY=sua_chave ao ficheiro .env na raiz do projeto (copie de .env.example). Reinicie npm run intellisearch-api",
		)
	}
	return k, nil
}

func fetchSerpAPI(params url.Values) (map[string]interface{}, error) {
	key, err := serpAPIKey()
	if err != nil {
		return nil, err
	}
	params.Set("api_key", key)
	u := serpBase + "?" + params.Encode()
	client := &http.Client{Timeout: 50 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return nil, fmt.Errorf("requisição SerpAPI: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("SerpAPI HTTP %d: %s", resp.StatusCode, string(body))
	}
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("JSON SerpAPI inválido: %w", err)
	}
	if errStr, ok := data["error"].(string); ok && errStr != "" {
		return nil, fmt.Errorf("SerpAPI: %s", errStr)
	}
	return data, nil
}

// SearchMaps pesquisa no Google Maps (resultados locais).
func SearchMaps(q string) (map[string]interface{}, error) {
	p := url.Values{}
	p.Set("engine", "google_maps")
	p.Set("q", q)
	p.Set("hl", "pt")
	p.Set("gl", "br")
	return fetchSerpAPI(p)
}

// GetPlaceDetails detalhes por place_id.
func GetPlaceDetails(placeID string) (map[string]interface{}, error) {
	p := url.Values{}
	p.Set("engine", "google_maps")
	p.Set("place_id", placeID)
	p.Set("hl", "pt")
	p.Set("gl", "br")
	return fetchSerpAPI(p)
}

// GetReviews opcional — engine google_maps_reviews.
func GetReviews(dataID string) (map[string]interface{}, error) {
	p := url.Values{}
	p.Set("engine", "google_maps_reviews")
	p.Set("data_id", dataID)
	p.Set("hl", "pt")
	return fetchSerpAPI(p)
}

// GetPhotos opcional.
func GetPhotos(dataID string) (map[string]interface{}, error) {
	p := url.Values{}
	p.Set("engine", "google_maps_photos")
	p.Set("data_id", dataID)
	return fetchSerpAPI(p)
}

func str(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch t := v.(type) {
			case string:
				if t != "" {
					return t
				}
			case float64:
				return fmt.Sprintf("%.0f", t)
			}
		}
	}
	return ""
}

func num(m map[string]interface{}, keys ...string) float64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch t := v.(type) {
			case float64:
				return t
			case int:
				return float64(t)
			case json.Number:
				f, _ := t.Float64()
				return f
			}
		}
	}
	return 0
}

func intFrom(m map[string]interface{}, keys ...string) int {
	v := num(m, keys...)
	if v <= 0 {
		return 0
	}
	return int(v + 0.5)
}

func hoursText(m map[string]interface{}) string {
	if h, ok := m["hours"]; ok && h != nil {
		if s, ok := h.(string); ok {
			return s
		}
		b, err := json.Marshal(h)
		if err == nil {
			return string(b)
		}
	}
	if open, ok := m["operating_hours"].(map[string]interface{}); ok {
		b, _ := json.Marshal(open)
		return string(b)
	}
	return ""
}

func categoryText(m map[string]interface{}) string {
	if t, ok := m["type"].(string); ok && t != "" {
		return t
	}
	if arr, ok := m["type"].([]interface{}); ok && len(arr) > 0 {
		if s, ok := arr[0].(string); ok {
			return s
		}
	}
	if cats, ok := m["categories"].([]interface{}); ok && len(cats) > 0 {
		if s, ok := cats[0].(string); ok {
			return s
		}
	}
	return str(m, "category")
}

func mergeBusiness(local map[string]interface{}, place map[string]interface{}) models.BusinessCard {
	b := models.BusinessCard{}
	src := local
	if len(place) > 0 {
		src = place
	}
	b.Name = str(src, "title", "name")
	if b.Name == "" {
		b.Name = str(local, "title", "name")
	}
	b.Address = str(src, "address", "snippet")
	if b.Address == "" {
		b.Address = str(local, "address")
	}
	b.Rating = num(src, "rating")
	if b.Rating == 0 {
		b.Rating = num(local, "rating")
	}
	b.ReviewsCount = intFrom(src, "reviews", "user_review_count", "user_ratings_total")
	if b.ReviewsCount == 0 {
		b.ReviewsCount = intFrom(local, "reviews", "user_review_count")
	}
	b.Phone = str(src, "phone", "formatted_phone_number")
	b.Website = str(src, "website", "link")
	b.Description = str(src, "description", "about")
	b.HoursSummary = hoursText(src)
	if b.HoursSummary == "" {
		b.HoursSummary = hoursText(local)
	}
	b.Category = categoryText(src)
	if b.Category == "" {
		b.Category = categoryText(local)
	}
	// Prefer serpapi_thumbnail: Google often returns lh3 …/gps-proxy/… URLs that 403/block
	// in browsers; SerpAPI’s proxy URL stays embeddable.
	b.Thumbnail = str(local, "serpapi_thumbnail")
	if b.Thumbnail == "" {
		b.Thumbnail = str(local, "thumbnail", "img")
	}
	if b.Thumbnail == "" {
		b.Thumbnail = str(src, "serpapi_thumbnail")
	}
	if b.Thumbnail == "" {
		b.Thumbnail = str(src, "thumbnail", "img")
	}
	b.GoogleMapsURL = str(src, "link", "maps_uri", "google_maps_url", "search_link")
	if b.GoogleMapsURL == "" {
		b.GoogleMapsURL = str(local, "link", "search_link")
	}
	b.PlaceID = str(local, "place_id")
	if b.PlaceID == "" {
		b.PlaceID = str(src, "place_id")
	}
	return b
}

func placeResultMap(placeResp map[string]interface{}) map[string]interface{} {
	if pr, ok := placeResp["place_results"].(map[string]interface{}); ok && pr != nil {
		return pr
	}
	if pr, ok := placeResp["place_results"].([]interface{}); ok && len(pr) > 0 {
		if m, ok := pr[0].(map[string]interface{}); ok {
			return m
		}
	}
	return nil
}

// AnalyzeBusinessOrError orquestra pesquisa + detalhe + opcional fotos; nunca inventa dados.
func AnalyzeBusinessOrError(query string) (*models.BusinessAnalysis, error) {
	q := query
	if q == "" {
		return nil, fmt.Errorf("query vazia")
	}
	search, err := SearchMaps(q)
	if err != nil {
		return nil, err
	}
	lrRaw, ok := search["local_results"]
	if !ok || lrRaw == nil {
		return nil, fmt.Errorf("nenhum resultado local no Google Maps para esta pesquisa")
	}
	lr, ok := lrRaw.([]interface{})
	if !ok || len(lr) == 0 {
		return nil, fmt.Errorf("lista de resultados vazia no Google Maps")
	}
	first, ok := lr[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("formato inesperado de resultado local")
	}
	placeID, _ := first["place_id"].(string)
	if placeID == "" {
		return nil, fmt.Errorf("place_id ausente no primeiro resultado — não é possível obter detalhes reais")
	}

	placeResp, err := GetPlaceDetails(placeID)
	var pr map[string]interface{}
	if err == nil && placeResp != nil {
		pr = placeResultMap(placeResp)
	}
	if pr == nil {
		pr = map[string]interface{}{}
	}

	b := mergeBusiness(first, pr)
	dataID, _ := first["data_id"].(string)
	if dataID == "" {
		dataID, _ = pr["data_id"].(string)
	}

	var photoURLs []string
	if dataID != "" {
		if ph, err := GetPhotos(dataID); err == nil {
			photoURLs = extractPhotoURLs(ph)
		}
	}
	if len(photoURLs) == 0 && b.Thumbnail != "" {
		photoURLs = []string{b.Thumbnail}
	}

	hasReviewsPayload := false
	if dataID != "" {
		if rev, err := GetReviews(dataID); err == nil && rev != nil {
			if rr, ok := rev["reviews"].([]interface{}); ok && len(rr) > 0 {
				hasReviewsPayload = true
			}
		}
	}

	photoCount := len(photoURLs)
	score := CalculateScore(b, photoCount, hasReviewsPayload)
	checklist, tiers := BuildChecklist(b, photoCount)
	b.PhotoURLs = photoURLs

	return &models.BusinessAnalysis{
		Query:      q,
		Score:      score,
		Checklist:  checklist,
		TierCounts: tiers,
		Business:   b,
		Source:     "serpapi",
	}, nil
}

func extractPhotoURLs(ph map[string]interface{}) []string {
	var out []string
	if imgs, ok := ph["photos"].([]interface{}); ok {
		for _, it := range imgs {
			m, ok := it.(map[string]interface{})
			if !ok {
				continue
			}
			u := str(m, "image", "thumbnail", "url")
			if u != "" {
				out = append(out, u)
			}
			if len(out) >= 12 {
				break
			}
		}
	}
	return out
}
