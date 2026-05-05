package middleware

import (
	"crypto/subtle"
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
	if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Defina o cabeçalho X-AdHub-Internal-Key igual a ADHUB_INTERNAL_API_KEY no servidor",
		})
	}
	return c.Next()
}
