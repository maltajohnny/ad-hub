package handlers

import (
	"norter/intellisearch/internal/models"
	"norter/intellisearch/internal/services"

	"github.com/gofiber/fiber/v2"
)

// GetOrganicRank GET /api/intellisearch/ranking?keyword=&domain=
func GetOrganicRank(c *fiber.Ctx) error {
	keyword := c.Query("keyword")
	domain := c.Query("domain")
	res, err := services.OrganicRankOrError(keyword, domain)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.APIError{Error: err.Error()})
	}
	return c.JSON(res)
}
