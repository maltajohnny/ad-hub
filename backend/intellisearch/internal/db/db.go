package db

import (
	"database/sql"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// DB é nil quando MYSQL_DSN não está definido (API segue sem persistir tokens).
var DB *sql.DB

// Init abre MySQL. Formato DSN (go-sql-driver):
//
//	USER:PASS@tcp(HOST:3306)/DBNAME?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci
func Init() error {
	dsn := strings.TrimSpace(os.Getenv("MYSQL_DSN"))
	if dsn == "" {
		log.Print("ad-platform: MYSQL_DSN vazio — tokens OAuth não persistidos (só memória no browser)")
		return nil
	}
	if !strings.Contains(dsn, "parseTime=") {
		if strings.Contains(dsn, "?") {
			dsn += "&parseTime=true"
		} else {
			dsn += "?parseTime=true"
		}
	}
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	conn.SetMaxOpenConns(12)
	conn.SetMaxIdleConns(4)
	// Hosting partilhado (ex. cPanel) costuma ter wait_timeout baixo — ligações idle fechadas pelo MySQL
	// geram "closing bad idle connection: EOF" no driver; reciclar antes evita surpresas ao reutilizar o pool.
	conn.SetConnMaxIdleTime(90 * time.Second)
	conn.SetConnMaxLifetime(55 * time.Minute)
	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return err
	}
	DB = conn
	log.Print("ad-platform: MySQL ligado — tabela ad_platform_oauth_tokens")
	return nil
}

func Available() bool {
	return DB != nil
}
