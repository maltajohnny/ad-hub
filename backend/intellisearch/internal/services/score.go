package services

import "norter/intellisearch/internal/models"

// CalculateScore pontua 0–100 com base em sinais reais do perfil (sem dados inventados).
func CalculateScore(b models.BusinessCard, photoCount int, hasReviewsPayload bool) int {
	score := 0
	if b.Rating > 4.5 {
		score += 20
	} else if b.Rating >= 4.0 {
		score += 12
	} else if b.Rating > 0 {
		score += 5
	}
	if b.ReviewsCount > 50 {
		score += 15
	} else if b.ReviewsCount >= 10 {
		score += 10
	} else if b.ReviewsCount > 0 {
		score += 5
	}
	if photoCount > 0 {
		score += 10
	}
	if b.Description != "" {
		score += 10
	}
	if b.HoursSummary != "" {
		score += 5
	}
	if b.Category != "" {
		score += 15
	}
	if b.Website != "" {
		score += 5
	}
	if b.Phone != "" {
		score += 5
	}
	if hasReviewsPayload {
		score += 5
	}
	if score > 100 {
		return 100
	}
	return score
}
