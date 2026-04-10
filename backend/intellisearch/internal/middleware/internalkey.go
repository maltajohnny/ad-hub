package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const headerInternalKey = "X-AdHub-Internal-Key"

// RequireInternalAPIKey exige cabeçalho quando ADHUB_INTERNAL_API_KEY está definido.
func RequireInternalAPIKey(c *fiber.Ctx) error {
	want := strings.TrimSpace(os.Getenv("ADHUB_INTERNAL_API_KEY"))
	if want == "" {
		return c.Next()
	}
	got := strings.TrimSpace(c.Get(headerInternalKey))
	if got != want {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Defina o cabeçalho X-AdHub-Internal-Key igual a ADHUB_INTERNAL_API_KEY no servidor",
		})
	}
	return c.Next()
}
