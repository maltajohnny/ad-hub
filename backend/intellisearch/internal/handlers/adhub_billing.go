package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	adhubjwt "norter/intellisearch/internal/auth"
	"norter/intellisearch/internal/asaas"
	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"

	"github.com/gofiber/fiber/v2"
)

var expiryRe = regexp.MustCompile(`^(\d{1,2})[/-](\d{2}|\d{4})$`)

const (
	priceGestorBase     = 169.90
	priceAddonPlatform  = 35.0
	priceGestorTeamSeat = 59.90
	priceOrgBase        = 297.0
	priceOrgExtraUser   = 40.0
	priceScaleBase      = 497.0
	yearlyDiscountFrac  = 0.3
)

func yearlyTotalFromMonthly(monthly float64) float64 {
	return math.Round(monthly*12*(1-yearlyDiscountFrac)*100) / 100
}

func expectedCheckoutBrl(planID string, yearly bool, addonPlatforms, gestorSeats, growthExtra int) float64 {
	var m float64
	switch planID {
	case "gestor":
		m = priceGestorBase + float64(addonPlatforms)*priceAddonPlatform + float64(gestorSeats)*priceGestorTeamSeat
	case "organizacao":
		m = priceOrgBase + float64(addonPlatforms)*priceAddonPlatform + float64(growthExtra)*priceOrgExtraUser
	case "scale":
		m = priceScaleBase + float64(addonPlatforms)*priceAddonPlatform
	default:
		return 0
	}
	if yearly {
		return yearlyTotalFromMonthly(m)
	}
	return round2Go(m)
}

// AdHubBillingCheckout POST /api/ad-hub/billing/asaas-checkout — JWT obrigatório; só admin de organização.
func AdHubBillingCheckout(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	tok := adHubBearerToken(c)
	if tok == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token em falta"})
	}
	claims, err := adhubjwt.ParseToken(tok)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}
	if claims.OrgID == "" || claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Apenas o administrador da organização pode subscrever um plano.",
		})
	}
	if isPlatformOperatorLogin(claims.Subject) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Operadores de plataforma não podem usar este checkout."})
	}

	ctx := context.Background()
	row, err := repo.GetByLoginKey(ctx, claims.Subject)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Utilizador não encontrado"})
	}
	var u map[string]interface{}
	if err := json.Unmarshal(row.UserJSON, &u); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Perfil inválido"})
	}
	orgInUser, _ := u["organizationId"].(string)
	if orgInUser != claims.OrgID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Contexto da organização inválido"})
	}

	var body struct {
		PlanTitle            string  `json:"planTitle"`
		PlanID               string  `json:"planId"`
		AmountBrl            float64 `json:"amountBrl"`
		Yearly               bool    `json:"yearly"`
		InstallmentCount     int     `json:"installmentCount"`
		GestorTeamSeats      int     `json:"gestorTeamSeats"`
		AddonPlatformCount   int     `json:"addonPlatformCount"`
		GrowthExtraUsers     int     `json:"growthExtraUsers"`
		HolderNameCard       string  `json:"holderNameCard"`
		CardNumber           string  `json:"cardNumber"`
		Expiry               string  `json:"expiry"`
		Cvv                  string  `json:"cvv"`
		HolderName           string  `json:"holderName"`
		Email                string  `json:"email"`
		CpfCnpj              string  `json:"cpfCnpj"`
		PostalCode           string  `json:"postalCode"`
		AddressNumber        string  `json:"addressNumber"`
		Phone                string  `json:"phone"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	if body.AmountBrl <= 0 || body.AmountBrl > 1e6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Valor inválido"})
	}
	if body.PlanID != "gestor" && body.PlanID != "organizacao" && body.PlanID != "scale" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Plano inválido"})
	}
	gestorSeats := body.GestorTeamSeats
	addonPlat := body.AddonPlatformCount
	growthX := body.GrowthExtraUsers
	if body.PlanID == "gestor" {
		if gestorSeats < 0 || gestorSeats > 3 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Equipa extra: 0 a 3 pessoas"})
		}
	} else {
		gestorSeats = 0
	}
	if addonPlat < 0 || addonPlat > 16 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Contagem de redes inválida"})
	}
	if body.PlanID == "organizacao" {
		if growthX < 0 || growthX > 3 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Utilizadores extra inválidos"})
		}
	} else {
		growthX = 0
	}
	exp := expectedCheckoutBrl(body.PlanID, body.Yearly, addonPlat, gestorSeats, growthX)
	if math.Abs(exp-body.AmountBrl) > 0.05 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Valor não coincide com o plano — atualize a página e tente novamente.",
		})
	}
	n := body.InstallmentCount
	if n < 1 {
		n = 1
	}
	if n > 21 {
		n = 21
	}

	month, year, ok := parseCardExpiryGo(body.Expiry)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Validade inválida (MM/AA)"})
	}
	cpf := digitsOnly(body.CpfCnpj)
	if len(cpf) != 11 && len(cpf) != 14 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "CPF/CNPJ inválido"})
	}
	phoneDigits := digitsOnly(body.Phone)
	if len(phoneDigits) < 10 || len(phoneDigits) > 11 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Telefone inválido"})
	}

	custBody := map[string]interface{}{
		"name":         strings.TrimSpace(body.HolderName),
		"email":        strings.TrimSpace(strings.ToLower(body.Email)),
		"cpfCnpj":      cpf,
		"mobilePhone":  phoneDigits,
		"phone":        phoneDigits,
	}
	rawCust, st, err := asaas.PostJSON("/customers", custBody)
	if err != nil || st >= 300 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": asaasErrMsg(rawCust, st)})
	}
	var custResp struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rawCust, &custResp); err != nil || custResp.ID == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Resposta Asaas inválida (cliente)"})
	}

	period := "monthly"
	if body.Yearly {
		period = "yearly"
	}
	ext := fmt.Sprintf("adh:%s:%s:%s:%d:g%d:a%d", claims.OrgID, body.PlanID, period, time.Now().UnixMilli(), gestorSeats, addonPlat)
	if body.PlanID == "organizacao" {
		ext += fmt.Sprintf(":x%d", growthX)
	}

	today := time.Now().UTC().Format("2006-01-02")
	total := round2Go(body.AmountBrl)

	cc := map[string]interface{}{
		"holderName":   strings.TrimSpace(body.HolderNameCard),
		"number":       digitsOnly(body.CardNumber),
		"expiryMonth":  month,
		"expiryYear":   year,
		"ccv":          strings.TrimSpace(body.Cvv),
	}
	holder := map[string]interface{}{
		"name":         strings.TrimSpace(body.HolderName),
		"email":        strings.TrimSpace(strings.ToLower(body.Email)),
		"cpfCnpj":      cpf,
		"postalCode":   formatCEP(body.PostalCode),
		"addressNumber": strings.TrimSpace(body.AddressNumber),
		"phone":        phoneDigits,
		"mobilePhone":  phoneDigits,
	}

	payBody := map[string]interface{}{
		"customer":              custResp.ID,
		"billingType":           "CREDIT_CARD",
		"dueDate":               today,
		"description":           truncateStr(body.PlanTitle, 500),
		"externalReference":     ext,
		"creditCard":            cc,
		"creditCardHolderInfo":  holder,
		"remoteIp":              clientIP(c),
	}
	if n <= 1 {
		payBody["value"] = total
	} else {
		per := round2Go(total / float64(n))
		payBody["value"] = total
		payBody["installmentCount"] = n
		payBody["installmentValue"] = per
	}

	rawPay, stPay, err := asaas.PostJSON("/payments", payBody)
	if err != nil || stPay >= 300 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": asaasErrMsg(rawPay, stPay)})
	}
	var payResp struct {
		ID         string `json:"id"`
		Status     string `json:"status"`
		InvoiceURL string `json:"invoiceUrl"`
	}
	if err := json.Unmarshal(rawPay, &payResp); err != nil || payResp.ID == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Resposta Asaas inválida (cobrança)"})
	}

	seatsCol := 0
	if body.PlanID == "gestor" {
		seatsCol = gestorSeats
	}
	_ = repo.UpdateOrgSubscriptionBilling(ctx, claims.OrgID, body.PlanID, period, "pending", custResp.ID, seatsCol)

	amountCents := int(round2Go(total*100) + 0.5)
	dueAt := time.Now().UTC()
	_, _ = repo.UpsertBillingInvoice(
		ctx, claims.OrgID, payResp.ID, "", truncateStr(body.PlanTitle, 250),
		amountCents, "BRL", strings.ToLower(strings.TrimSpace(payResp.Status)), &dueAt, nil, payResp.InvoiceURL,
	)

	return c.JSON(fiber.Map{
		"ok":         true,
		"paymentId":  payResp.ID,
		"status":     payResp.Status,
		"invoiceUrl": payResp.InvoiceURL,
	})
}

// AdHubBillingWebhook POST /api/ad-hub/billing/asaas-webhook — eventos Asaas (cabeçalho asaas-access-token opcional mas recomendado).
func AdHubBillingWebhook(c *fiber.Ctx) error {
	if db.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "MySQL indisponível"})
	}
	expect := strings.TrimSpace(os.Getenv("ASAAS_WEBHOOK_TOKEN"))
	if expect != "" {
		if c.Get("asaas-access-token") != expect {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
	}

	var payload struct {
		ID      string `json:"id"`
		Event   string `json:"event"`
		Payment *struct {
			ID                string `json:"id"`
			Status            string `json:"status"`
			Customer          string `json:"customer"`
			ExternalReference string `json:"externalReference"`
		} `json:"payment"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON inválido"})
	}
	ev := strings.TrimSpace(payload.Event)
	if payload.ID != "" {
		ctx := context.Background()
		inserted, err := repo.InsertWebhookEventIdempotency(ctx, payload.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao registar evento"})
		}
		if !inserted {
			return c.JSON(fiber.Map{"ok": true, "duplicate": true})
		}
	}

	switch ev {
	case "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED":
	default:
		return c.JSON(fiber.Map{"ok": true, "ignored": true})
	}

	if payload.Payment == nil || payload.Payment.ExternalReference == "" {
		return c.JSON(fiber.Map{"ok": true})
	}

	orgID, planSlug, period, gSeats, ok := parseBillingExternalRef(payload.Payment.ExternalReference)
	if !ok || orgID == "" || planSlug == "" {
		return c.JSON(fiber.Map{"ok": true})
	}

	ctx := context.Background()
	if _, err := repo.GetOrganizationByID(ctx, orgID); err != nil {
		return c.JSON(fiber.Map{"ok": true})
	}

	cust := strings.TrimSpace(payload.Payment.Customer)
	seatsUpdate := -1
	if planSlug == "gestor" && gSeats >= 0 {
		seatsUpdate = gSeats
	}
	if planSlug == "organizacao" || planSlug == "scale" {
		seatsUpdate = 0
	}
	_ = repo.UpdateOrgSubscriptionBilling(ctx, orgID, planSlug, period, "active", cust, seatsUpdate)

	now := time.Now().UTC()
	_, _ = repo.UpsertBillingInvoice(
		ctx, orgID, payload.Payment.ID, "", "Plano "+planSlug,
		0, "BRL", "paid", nil, &now, "",
	)

	return c.JSON(fiber.Map{"ok": true})
}

// parseBillingExternalRef: adh:uuid:plan:period:ms:gN:aM[:xK]
func parseBillingExternalRef(ext string) (orgID, planSlug, period string, gSeats int, ok bool) {
	parts := strings.Split(ext, ":")
	if len(parts) < 5 || parts[0] != "adh" {
		return "", "", "", -1, false
	}
	orgID, planSlug, period = parts[1], parts[2], parts[3]
	gSeats = -1
	for _, p := range parts[5:] {
		if strings.HasPrefix(p, "g") {
			gSeats, _ = strconv.Atoi(strings.TrimPrefix(p, "g"))
		}
	}
	return orgID, planSlug, period, gSeats, true
}

func clientIP(c *fiber.Ctx) string {
	if xff := c.Get("x-forwarded-for"); xff != "" {
		p := strings.Split(xff, ",")[0]
		return stripV4(strings.TrimSpace(p))
	}
	if xri := c.Get("x-real-ip"); xri != "" {
		return stripV4(strings.TrimSpace(xri))
	}
	return stripV4(c.IP())
}

func stripV4(ip string) string {
	if strings.HasPrefix(ip, "::ffff:") {
		return ip[7:]
	}
	return ip
}

func parseCardExpiryGo(s string) (month, year string, ok bool) {
	t := strings.TrimSpace(s)
	m := expiryRe.FindStringSubmatch(strings.ReplaceAll(t, " ", ""))
	if m == nil {
		return "", "", false
	}
	mo, _ := strconv.Atoi(m[1])
	if mo < 1 || mo > 12 {
		return "", "", false
	}
	month = fmt.Sprintf("%02d", mo)
	yr := m[2]
	if len(yr) == 2 {
		yr = "20" + yr
	}
	if len(yr) != 4 {
		return "", "", false
	}
	return month, yr, true
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func formatCEP(s string) string {
	d := digitsOnly(s)
	if len(d) != 8 {
		return strings.TrimSpace(s)
	}
	return d[:5] + "-" + d[5:]
}

func round2Go(x float64) float64 {
	return math.Round(x*100) / 100
}

func truncateStr(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func asaasErrMsg(raw []byte, status int) string {
	var wrap struct {
		Errors []struct {
			Description string `json:"description"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &wrap); err == nil && len(wrap.Errors) > 0 && wrap.Errors[0].Description != "" {
		return wrap.Errors[0].Description
	}
	if status > 0 {
		return fmt.Sprintf("Asaas (HTTP %d)", status)
	}
	return "Erro Asaas"
}
