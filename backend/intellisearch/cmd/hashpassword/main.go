// Gera hash bcrypt para colocar em SQL (reset manual de admin).
// Uso: go run ./cmd/hashpassword 'sua_senha_segura'
package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "uso: go run ./cmd/hashpassword '<senha>'")
		os.Exit(1)
	}
	b, err := bcrypt.GenerateFromPassword([]byte(os.Args[1]), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(string(b))
}
