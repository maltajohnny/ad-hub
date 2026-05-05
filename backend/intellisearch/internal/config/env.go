package config

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

// LoadDotenv carrega `.env` (vários caminhos relativos ao cwd, típico `backend/intellisearch`).
// Ordem: cwd → pais até à raiz do repo; depois ~/ad-hub.digital/.env. Não se carrega ~/apps/minha-api/.env
// aqui (fora do cwd minha-api) para não sobrescrever SERPAPI_KEY em desenvolvimento local.
//
// Nota: godotenv.Overload pode definir SERPAPI_KEY= vazio a partir de um .env intermédio e apagar
// o valor já injetado por env-cmd; por isso guardamos/restauramos e aplicamos ainda leitura explícita na raiz.
func LoadDotenv() {
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}
	snapshotSerp := strings.TrimSpace(os.Getenv("SERPAPI_KEY"))
	snapshotPort := strings.TrimSpace(os.Getenv("PORT"))

	paths := []string{
		filepath.Join(wd, ".env"),
		filepath.Join(wd, "..", ".env"),
		filepath.Join(wd, "..", "..", ".env"),
		// Deploy típico: clone em ~/ad-hub.digital (carrega primeiro; pode ser sobrescrito abaixo)
		filepath.Join(wd, "..", "..", "ad-hub.digital", ".env"),
	}
	if home := strings.TrimSpace(os.Getenv("HOME")); home != "" {
		paths = append(paths, filepath.Join(home, "ad-hub.digital", ".env"))
		// NÃO carregar ~/apps/minha-api/.env aqui quando o cwd não é essa pasta: em Macs de dev esse
		// ficheiro costuma existir (cópia do servidor) e godotenv.Overload com SERPAPI_KEY vazio apaga
		// o valor já vindo de env-cmd / .env na raiz do repo.
	}
	for _, p := range paths {
		if err := godotenv.Overload(p); err != nil {
			continue
		}
		log.Printf("intellisearch: variáveis lidas de %s", p)
	}

	if strings.TrimSpace(os.Getenv("SERPAPI_KEY")) == "" && snapshotSerp != "" {
		os.Setenv("SERPAPI_KEY", snapshotSerp)
		log.Print("intellisearch: SERPAPI_KEY restaurada (evitada sobrescrita vazia por .env intermédio)")
	}
	if snapshotPort != "" {
		// Permite override de porta em runtime (ex.: restart de emergência noutra porta),
		// mesmo quando o .env define PORT fixo.
		os.Setenv("PORT", snapshotPort)
		log.Printf("intellisearch: PORT preservada do ambiente (%s)", snapshotPort)
	}

	applySerpAPIKeyFromRootEnvFiles(wd)

	if strings.TrimSpace(os.Getenv("SERPAPI_KEY")) == "" {
		log.Print("intellisearch: SERPAPI_KEY vazia — confirme a linha no .env na raiz do repositório e reinicie a API")
	}
}

// applySerpAPIKeyFromRootEnvFiles define SERPAPI_KEY a partir do ficheiro .env na raiz do repo
// (parse explícito), útil quando o cwd ou a ordem de Overload não refletem a chave.
func applySerpAPIKeyFromRootEnvFiles(wd string) {
	if strings.TrimSpace(os.Getenv("SERPAPI_KEY")) != "" {
		return
	}
	// Preferir .env do repositório antes de cópias em HOME (minha-api no Mac pode ter SERPAPI_KEY vazio).
	candidates := []string{
		filepath.Join(wd, "..", "..", "ad-hub.digital", ".env"),
		filepath.Join(wd, "..", "..", ".env"),
		filepath.Join(wd, "..", ".env"),
		filepath.Join(wd, ".env"),
	}
	if home := strings.TrimSpace(os.Getenv("HOME")); home != "" {
		candidates = append(
			candidates,
			filepath.Join(home, "ad-hub.digital", ".env"),
			filepath.Join(home, "apps", "minha-api", ".env"),
		)
	}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		m, err := godotenv.Parse(bytes.NewReader(data))
		if err != nil {
			continue
		}
		if v := strings.TrimSpace(m["SERPAPI_KEY"]); v != "" {
			os.Setenv("SERPAPI_KEY", v)
			log.Printf("intellisearch: SERPAPI_KEY aplicada desde %s", p)
			return
		}
	}
}
