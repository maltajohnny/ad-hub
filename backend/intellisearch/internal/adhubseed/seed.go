package adhubseed

import (
	"context"
	"encoding/json"
	"log"

	"golang.org/x/crypto/bcrypt"

	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"
)

const (
	builtinNorterID   = "00000000-0000-4000-8000-000000000001"
	builtinQtrafficID = "00000000-0000-4000-8000-000000000002"
)

type seedUser struct {
	Login    string
	Password string
	User     map[string]interface{}
}

// SeedDefaultsIfEmpty insere os utilizadores embutidos quando a tabela está vazia.
func SeedDefaultsIfEmpty(ctx context.Context) error {
	if db.DB == nil {
		return nil
	}
	n, err := repo.Count(ctx)
	if err != nil || n > 0 {
		return err
	}

	seed := []seedUser{
		{
			Login:    "admin",
			Password: "p4p4l3gu4$",
			User: map[string]interface{}{
				"role": "admin", "username": "admin", "name": "Administrador",
				"email": "admin@norter.com", "phone": "(11) 99999-0000", "document": "000.000.000-00",
				"organizationId": builtinQtrafficID,
			},
		},
		{
			Login:    "norter",
			Password: "N0rt3r@26",
			User: map[string]interface{}{
				"role": "user", "username": "norter", "name": "Norter User",
				"email": "contato@norter.com", "phone": "(11) 98888-0000", "document": "111.111.111-11",
				"organizationId": builtinNorterID,
			},
		},
		{
			Login:    "qtrafficadmin",
			Password: "Qtr@ffic#26",
			User: map[string]interface{}{
				"role": "admin", "username": "qtrafficadmin", "name": "Operador AD-Hub",
				"email": "ops@orbix.com", "phone": "(11) 90000-0000", "document": "000.000.000-01",
				"organizationId": builtinQtrafficID,
			},
		},
		{
			Login:    "diego.norter",
			Password: "N0rt3rD!ego",
			User: map[string]interface{}{
				"role": "admin", "username": "diego.norter", "name": "Diego — Norter",
				"email": "diego@norter.com", "phone": "(11) 97777-0000", "document": "222.222.222-22",
				"organizationId": builtinNorterID,
			},
		},
	}

	for _, s := range seed {
		hash, err := bcrypt.GenerateFromPassword([]byte(s.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		userJSON, err := json.Marshal(s.User)
		if err != nil {
			return err
		}
		if err := repo.InsertUser(ctx, s.Login, string(hash), userJSON); err != nil {
			return err
		}
	}
	log.Print("adhub: utilizadores predefinidos inseridos na tabela users")
	return nil
}
