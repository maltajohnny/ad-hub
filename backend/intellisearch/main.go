package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"norter/intellisearch/internal/adhubseed"
	"norter/intellisearch/internal/config"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/handlers"
	"norter/intellisearch/internal/middleware"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

func main() {
	config.LoadDotenv()

	if err := db.Init(); err != nil {
		log.Printf("MySQL (OAuth persist): %v — API a correr sem base para tokens", err)
	} else if err := adhubseed.SeedDefaultsIfEmpty(context.Background()); err != nil {
		log.Printf("adhub seed utilizadores: %v", err)
	}
	if db.DB != nil {
		if err := repo.EnsureAdsAPIKeysTable(context.Background(), db.DB); err != nil {
			log.Printf("adhub: tabela ads_api_keys indisponível: %v", err)
		}
		if err := repo.EnsureAdHubAuthSecurityTables(context.Background(), db.DB); err != nil {
			log.Printf("adhub: tabelas auth_security indisponíveis: %v", err)
		}
		if err := repo.EnsureInsightHubTables(context.Background(), db.DB); err != nil {
			log.Printf("adhub: tabelas insight_hub indisponíveis: %v", err)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3041"
	}

	allowedOriginsCSV := strings.TrimSpace(os.Getenv("ADHUB_ALLOWED_ORIGINS"))
	if allowedOriginsCSV == "" {
		allowedOriginsCSV = "https://ad-hub.digital,https://www.ad-hub.digital,http://localhost:8080,http://127.0.0.1:8080"
	}

	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		BodyLimit:             1 * 1024 * 1024,
		ReadTimeout:           10 * time.Second,
		WriteTimeout:          15 * time.Second,
		IdleTimeout:           60 * time.Second,
		ReduceMemoryUsage:     true,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOriginsCSV,
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization,Access-Token,X-AdHub-Internal-Key",
		AllowCredentials: true,
	}))
	app.Use("/api", limiter.New(limiter.Config{
		Max:        120,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Demasiados pedidos, tente novamente."})
		},
	}))

	authLimiter := limiter.New(limiter.Config{
		Max:        8,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + ":" + c.Path()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Muitas tentativas, aguarde 1 minuto."})
		},
	})

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
	hub.Post("/login", authLimiter, handlers.AdHubLogin)
	hub.Post("/register", handlers.AdHubRegister)
	hub.Post("/forgot-password", authLimiter, handlers.AdHubForgotPassword)
	hub.Post("/reset-password", authLimiter, handlers.AdHubResetPassword)
	hub.Post("/password", authLimiter, handlers.AdHubChangePassword)
	hub.Get("/registry", handlers.AdHubRegistry)
	hub.Get("/organization/subscription", handlers.AdHubOrgSubscription)
	hub.All("/platform/modules-config", handlers.AdHubPlatformModulesConfig)
	hub.Post("/users", middleware.RequireAdHubAdmin, handlers.AdHubCreateUser)
	hub.Patch("/users/:login", middleware.RequireAdHubAdmin, handlers.AdHubPatchUser)
	hub.Delete("/users/:login", middleware.RequireAdHubAdmin, handlers.AdHubDeleteUser)

	bill := app.Group("/api/ad-hub/billing")
	bill.Post("/asaas-checkout", handlers.AdHubBillingCheckout)
	bill.Post("/asaas-webhook", handlers.AdHubBillingWebhook)

	ih := app.Group("/api/ad-hub/insight-hub", middleware.RequireAdHubSession)
	ih.Get("/bootstrap", handlers.InsightHubBootstrap)
	ih.Get("/brands", handlers.InsightHubListBrands)
	ih.Post("/brands", handlers.InsightHubCreateBrand)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "intellisearch"})
	})

	log.Printf("API a ouvir em :%s — /api/intellisearch/*, /api/ad-platform/*, /api/ad-hub/auth/*, /api/ad-hub/insight-hub/*", port)
	log.Fatal(app.Listen(":" + port))
}
