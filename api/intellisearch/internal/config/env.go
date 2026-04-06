package config

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

// LoadDotenv carrega `.env` (vários caminhos relativos ao cwd, típico `api/intellisearch`).
// Ordem: pastas mais profundas primeiro; a raiz do repo por último — assim SERPAPI_KEY na raiz prevalece.
//
// Nota: godotenv.Overload pode definir SERPAPI_KEY= vazio a partir de um .env intermédio e apagar
// o valor já injetado por env-cmd; por isso guardamos/restauramos e aplicamos ainda leitura explícita na raiz.
func LoadDotenv() {
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}
	snapshotSerp := strings.TrimSpace(os.Getenv("SERPAPI_KEY"))

	paths := []string{
		filepath.Join(wd, ".env"),
		filepath.Join(wd, "..", ".env"),
		filepath.Join(wd, "..", "..", ".env"),
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
	candidates := []string{
		filepath.Join(wd, "..", "..", ".env"),
		filepath.Join(wd, "..", ".env"),
		filepath.Join(wd, ".env"),
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
