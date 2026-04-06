package services

import (
	"fmt"
	"strconv"

	"norter/intellisearch/internal/models"
)

// BuildChecklist gera itens auditáveis apenas a partir de campos reais (sem LLM).
func BuildChecklist(b models.BusinessCard, photoCount int) ([]models.CheckItem, models.TierCounts) {
	var items []models.CheckItem
	var weak, reasonable, good int
	n := 0
	add := func(category, label string, status string, detail string) {
		n++
		items = append(items, models.CheckItem{
			ID:       strconv.Itoa(n),
			Category: category,
			Label:    label,
			Status:   status,
			Detail:   detail,
		})
		switch status {
		case "weak":
			weak++
		case "reasonable":
			reasonable++
		case "good":
			good++
		}
	}

	// Avaliação média
	if b.Rating <= 0 {
		add("Avaliações", "Nota média", "weak", "Sem nota pública no resultado da API.")
	} else if b.Rating >= 4.5 {
		add("Avaliações", "Nota média", "good", fmt.Sprintf("%.1f — acima de 4,5.", b.Rating))
	} else if b.Rating >= 4.0 {
		add("Avaliações", "Nota média", "reasonable", fmt.Sprintf("%.1f — razoável; há margem para subir.", b.Rating))
	} else {
		add("Avaliações", "Nota média", "weak", fmt.Sprintf("%.1f — abaixo do ideal para confiança local.", b.Rating))
	}

	// Volume de reviews
	if b.ReviewsCount >= 50 {
		add("Avaliações", "Volume de avaliações", "good", fmt.Sprintf("%d avaliações — volume sólido.", b.ReviewsCount))
	} else if b.ReviewsCount >= 10 {
		add("Avaliações", "Volume de avaliações", "reasonable", fmt.Sprintf("%d avaliações — pode crescer com pedidos aos clientes.", b.ReviewsCount))
	} else if b.ReviewsCount > 0 {
		add("Avaliações", "Volume de avaliações", "weak", fmt.Sprintf("Apenas %d avaliações — pouca prova social.", b.ReviewsCount))
	} else {
		add("Avaliações", "Volume de avaliações", "weak", "Sem contagem de avaliações no resultado.")
	}

	// Fotos
	if photoCount > 5 {
		add("Mídia", "Fotos", "good", fmt.Sprintf("%d fotos identificadas no resultado.", photoCount))
	} else if photoCount > 0 {
		add("Mídia", "Fotos", "reasonable", fmt.Sprintf("%d foto(s); considere mais imagens do espaço e produtos.", photoCount))
	} else {
		add("Mídia", "Fotos", "weak", "Nenhuma foto listada no payload devolvido pela API.")
	}

	// Categoria
	if b.Category != "" {
		add("Perfil", "Categoria", "good", b.Category)
	} else {
		add("Perfil", "Categoria", "weak", "Categoria não encontrada no resultado.")
	}

	// Descrição
	if len(b.Description) > 80 {
		add("Perfil", "Descrição", "good", "Descrição com texto substancial.")
	} else if b.Description != "" {
		add("Perfil", "Descrição", "reasonable", "Descrição curta — pode expandir com palavras-chave locais.")
	} else {
		add("Perfil", "Descrição", "weak", "Sem descrição no resultado da API.")
	}

	// Horário
	if b.HoursSummary != "" {
		add("Horário", "Horário de funcionamento", "good", b.HoursSummary)
	} else {
		add("Horário", "Horário de funcionamento", "weak", "Horário não disponível ou não estruturado na resposta.")
	}

	// Contacto
	if b.Phone != "" && b.Website != "" {
		add("Contacto", "Telefone e site", "good", "Telefone e website presentes.")
	} else if b.Phone != "" || b.Website != "" {
		add("Contacto", "Telefone e site", "reasonable", "Complete telefone e website se faltar um deles.")
	} else {
		add("Contacto", "Telefone e site", "weak", "Telefone e website ausentes no resultado.")
	}

	return items, models.TierCounts{Weak: weak, Reasonable: reasonable, Good: good}
}
