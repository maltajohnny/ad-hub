package main

import (
	"context"
	"log"
	"os"

	"norter/intellisearch/internal/adhubseed"
	"norter/intellisearch/internal/config"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/handlers"
	"norter/intellisearch/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	config.LoadDotenv()

	if err := db.Init(); err != nil {
		log.Printf("MySQL (OAuth persist): %v — API a correr sem base para tokens", err)
	} else if err := adhubseed.SeedDefaultsIfEmpty(context.Background()); err != nil {
		log.Printf("adhub seed utilizadores: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3041"
	}

	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization,Access-Token,X-AdHub-Internal-Key",
	}))

	api := app.Group("/api/intellisearch")
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "intellisearch"})
	})
	api.Get("/business", handlers.GetBusiness)
	api.Get("/ranking", handlers.GetOrganicRank)

	ad := app.Group("/api/ad-platform")
	ad.Post("/meta/oauth/token", handlers.MetaOAuthToken)
	ad.Get("/meta/adaccounts", handlers.MetaAdAccounts)
	ad.Get("/meta/insights", handlers.MetaInsights)
	ad.Post("/tiktok/oauth/token", handlers.TikTokOAuthToken)
	ad.Post("/tiktok/advertisers", handlers.TikTokAdvertisers)
	ad.Post("/tiktok/report/basic", handlers.TikTokBasicReport)

	persist := ad.Group("/persist", middleware.RequireInternalAPIKey)
	persist.Post("/meta/oauth/finish", handlers.PersistMetaOAuthFinish)
	persist.Post("/tiktok/oauth/finish", handlers.PersistTikTokOAuthFinish)
	persist.Post("/link-and-sync", handlers.PersistLinkAndSync)
	persist.Post("/metrics/refresh", handlers.PersistMetricsRefresh)
	persist.Post("/metrics/refresh-client", handlers.PersistMetricsRefreshClient)

	hub := app.Group("/api/ad-hub/auth")
	hub.Get("/ping", handlers.AdHubPing)
	hub.Post("/login", handlers.AdHubLogin)
	hub.Post("/register", handlers.AdHubRegister)
	hub.Post("/forgot-password", handlers.AdHubForgotPassword)
	hub.Post("/reset-password", handlers.AdHubResetPassword)
	hub.Post("/password", handlers.AdHubChangePassword)
	hub.Get("/registry", handlers.AdHubRegistry)
	hub.Get("/organization/subscription", handlers.AdHubOrgSubscription)
	hub.Post("/users", handlers.AdHubCreateUser)
	hub.Patch("/users/:login", handlers.AdHubPatchUser)
	hub.Delete("/users/:login", handlers.AdHubDeleteUser)

	bill := app.Group("/api/ad-hub/billing")
	bill.Post("/asaas-checkout", handlers.AdHubBillingCheckout)
	bill.Post("/asaas-webhook", handlers.AdHubBillingWebhook)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "intellisearch"})
	})

	log.Printf("API a ouvir em :%s — /api/intellisearch/*, /api/ad-platform/*, /api/ad-hub/auth/*", port)
	log.Fatal(app.Listen(":" + port))
}
