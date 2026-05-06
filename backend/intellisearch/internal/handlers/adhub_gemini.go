package handlers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const defaultGeminiModel = "gemini-2.5-flash"

// AdHubGeminiGenerate faz proxy autenticado para generateContent (chave só no servidor).
// POST body = JSON igual ao da API Google Generative Language.
func AdHubGeminiGenerate(c *fiber.Ctx) error {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "GEMINI_API_KEY não definida na API. Adicione em ~/apps/minha-api/.env junto ao binário e reinicie o processo.",
		})
	}

	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = defaultGeminiModel
	}

	body := c.Body()
	if len(bytes.TrimSpace(body)) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "corpo JSON vazio"})
	}

	base := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent"
	fullURL := base + "?" + url.Values{"key": []string{apiKey}}.Encode()

	client := &http.Client{Timeout: 120 * time.Second}
	ctx := c.UserContext()
	if ctx == nil {
		ctx = context.Background()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fullURL, bytes.NewReader(body))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "application/json; charset=utf-8")
	return c.Status(resp.StatusCode).Send(raw)
}
