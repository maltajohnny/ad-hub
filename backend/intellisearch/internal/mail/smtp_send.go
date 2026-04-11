package mail

import (
	"fmt"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

// SendPlain envia um e-mail em texto simples (STARTTLS em 587). Se ADHUB_SMTP_HOST estiver vazio, não envia e devolve false, nil.
func SendPlain(subject, body string, to []string) (sent bool, err error) {
	host := strings.TrimSpace(os.Getenv("ADHUB_SMTP_HOST"))
	if host == "" {
		return false, nil
	}
	portStr := strings.TrimSpace(os.Getenv("ADHUB_SMTP_PORT"))
	if portStr == "" {
		portStr = "587"
	}
	if _, err := strconv.Atoi(portStr); err != nil {
		return false, fmt.Errorf("ADHUB_SMTP_PORT inválido")
	}
	user := strings.TrimSpace(os.Getenv("ADHUB_SMTP_USER"))
	pass := strings.TrimSpace(os.Getenv("ADHUB_SMTP_PASSWORD"))
	from := strings.TrimSpace(os.Getenv("ADHUB_MAIL_FROM"))
	if from == "" {
		from = user
	}
	if from == "" || len(to) == 0 {
		return false, fmt.Errorf("ADHUB_MAIL_FROM ou destinatários em falta")
	}

	addr := fmt.Sprintf("%s:%s", host, portStr)
	header := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n",
		from, strings.Join(to, ", "), subject)
	msg := []byte(header + body)

	auth := smtp.PlainAuth("", user, pass, host)
	return true, smtp.SendMail(addr, auth, from, to, msg)
}
