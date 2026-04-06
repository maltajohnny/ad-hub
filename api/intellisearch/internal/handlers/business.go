package handlers

import (
	"norter/intellisearch/internal/models"
	"norter/intellisearch/internal/services"

	"github.com/gofiber/fiber/v2"
)

// GetBusiness analisa o primeiro resultado real do Google Maps para a query (SerpAPI).
func GetBusiness(c *fiber.Ctx) error {
	q := c.Query("query")
	if q == "" {
		q = c.Query("q")
	}
	analysis, err := services.AnalyzeBusinessOrError(q)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.APIError{Error: err.Error()})
	}
	return c.JSON(analysis)
}
