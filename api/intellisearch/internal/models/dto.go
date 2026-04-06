package models

// BusinessAnalysis é a resposta JSON para o dashboard (dados reais SerpAPI apenas).
type BusinessAnalysis struct {
	Query      string         `json:"query"`
	Score      int            `json:"score"`
	Checklist  []CheckItem    `json:"checklist"`
	TierCounts TierCounts     `json:"tier_counts"`
	Business   BusinessCard   `json:"business"`
	Source     string         `json:"source"` // "serpapi"
	Error      string         `json:"error,omitempty"`
}

type TierCounts struct {
	Weak        int `json:"weak"`
	Reasonable  int `json:"reasonable"`
	Good        int `json:"good"`
}

type CheckItem struct {
	ID       string `json:"id"`
	Category string `json:"category"`
	Label    string `json:"label"`
	Status   string `json:"status"` // good | reasonable | weak
	Detail   string `json:"detail"`
}

type BusinessCard struct {
	Name           string   `json:"name"`
	Category       string   `json:"category"`
	Rating         float64  `json:"rating"`
	ReviewsCount   int      `json:"reviews_count"`
	Address        string   `json:"address"`
	HoursSummary   string   `json:"hours_summary"`
	Website        string   `json:"website"`
	Phone          string   `json:"phone"`
	Description    string   `json:"description"`
	GoogleMapsURL  string   `json:"google_maps_url"`
	Thumbnail      string   `json:"thumbnail,omitempty"`
	PhotoURLs      []string `json:"photo_urls"`
	PlaceID        string   `json:"place_id,omitempty"`
}

type APIError struct {
	Error string `json:"error"`
}
