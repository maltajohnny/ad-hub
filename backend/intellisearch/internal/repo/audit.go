package repo

import (
	"context"
	"strings"

	"norter/intellisearch/internal/db"
)

// WriteAuditLog grava evento mínimo (ignora silenciosamente se BD off).
func WriteAuditLog(ctx context.Context, orgID, actor, action, entityType, entityID, detailJSON string) {
	if db.DB == nil {
		return
	}
	_, _ = db.DB.ExecContext(ctx, `
INSERT INTO audit_log (organization_id, actor_username, action, entity_type, entity_id, detail, created_at)
VALUES (NULLIF(?, ''), NULLIF(?, ''), ?, NULLIF(?, ''), NULLIF(?, ''), ?, UTC_TIMESTAMP(3))`,
		strings.TrimSpace(orgID), strings.TrimSpace(actor), strings.TrimSpace(action),
		strings.TrimSpace(entityType), strings.TrimSpace(entityID),
		nullIfEmptyJSONString(detailJSON),
	)
}
