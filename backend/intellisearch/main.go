package main

import (
	"log"
	"os"

	"norter/intellisearch/internal/config"
	"norter/intellisearch/internal/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	config.LoadDotenv()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3041"
	}

	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,OPTIONS",
		AllowHeaders: "Content-Type",
	}))

	api := app.Group("/api/intellisearch")
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "intellisearch"})
	})
	api.Get("/business", handlers.GetBusiness)
	api.Get("/ranking", handlers.GetOrganicRank)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "intellisearch"})
	})

	log.Printf("IntelliSearch API a ouvir em :%s (GET /api/intellisearch/business|ranking)", port)
	log.Fatal(app.Listen(":" + port))
}
