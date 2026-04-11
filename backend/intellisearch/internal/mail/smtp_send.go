package mail

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

// SendPlain envia e-mail em texto simples.
// Porta 587: STARTTLS (net/smtp.SendMail).
// Porta 465: SSL implícito (SMTPS) — ligação TLS desde o início.
// Se ADHUB_SMTP_HOST estiver vazio, não envia e devolve false, nil.
func SendPlain(subject, body string, to []string) (sent bool, err error) {
	host := strings.TrimSpace(os.Getenv("ADHUB_SMTP_HOST"))
	if host == "" {
		return false, nil
	}
	portStr := strings.TrimSpace(os.Getenv("ADHUB_SMTP_PORT"))
	if portStr == "" {
		portStr = "587"
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
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

	header := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n",
		from, strings.Join(to, ", "), subject)
	msg := []byte(header + body)

	auth := smtp.PlainAuth("", user, pass, host)
	if port == 465 {
		return true, sendSMTPS(host, portStr, auth, envelopeFrom(from), to, msg)
	}
	addr := fmt.Sprintf("%s:%s", host, portStr)
	return true, smtp.SendMail(addr, auth, from, to, msg)
}

// envelopeFrom extrai o endereço para MAIL FROM (evita "Nome <x@y>" se o servidor for estrito).
func envelopeFrom(from string) string {
	from = strings.TrimSpace(from)
	if i := strings.LastIndex(from, "<"); i >= 0 {
		if j := strings.LastIndex(from, ">"); j > i {
			return strings.TrimSpace(from[i+1 : j])
		}
	}
	return from
}

func sendSMTPS(host, port string, auth smtp.Auth, from string, to []string, msg []byte) error {
	addr := net.JoinHostPort(host, port)
	tlsCfg := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return err
	}
	defer conn.Close()
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer c.Close()
	if err := c.Hello("localhost"); err != nil {
		return err
	}
	if ok, _ := c.Extension("AUTH"); ok {
		if err := c.Auth(auth); err != nil {
			return err
		}
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	for _, rcpt := range to {
		if err := c.Rcpt(rcpt); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
