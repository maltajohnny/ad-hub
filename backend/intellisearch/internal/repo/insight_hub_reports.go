package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// InsightHubReportRow item de listagem.
type InsightHubReportRow struct {
	ID        string  `json:"id"`
	BrandID   *string `json:"brandId,omitempty"`
	Title     string  `json:"title"`
	Template  string  `json:"templateKey,omitempty"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

// CreateInsightHubReport persiste novo relatório (definição em JSON).
func CreateInsightHubReport(ctx context.Context, orgID, brandID, title, definitionJSON, templateKey string) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	id := NewUUID()
	var brand interface{}
	if b := strings.TrimSpace(brandID); b != "" {
		brand = b
	}
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_reports (id, organization_id, brand_id, title, definition_json, template_key, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, NULLIF(?,''), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, strings.TrimSpace(orgID), brand, strings.TrimSpace(title),
		nullIfEmptyJSONString(definitionJSON), strings.TrimSpace(templateKey),
	)
	return id, err
}

// ListInsightHubReports lista relatórios da organização (filtra por brand opcional).
func ListInsightHubReports(ctx context.Context, orgID, brandID string) ([]InsightHubReportRow, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	q := `
SELECT id, brand_id, title, COALESCE(template_key,''),
       DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ'),
       DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ')
FROM insight_hub_reports
WHERE organization_id = ?`
	args := []interface{}{strings.TrimSpace(orgID)}
	if b := strings.TrimSpace(brandID); b != "" {
		q += " AND brand_id = ?"
		args = append(args, b)
	}
	q += " ORDER BY updated_at DESC"
	rows, err := db.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InsightHubReportRow
	for rows.Next() {
		var r InsightHubReportRow
		var brand sql.NullString
		if err := rows.Scan(&r.ID, &brand, &r.Title, &r.Template, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		if brand.Valid {
			s := brand.String
			r.BrandID = &s
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetInsightHubReport devolve definição completa para o frontend renderizar.
func GetInsightHubReport(ctx context.Context, orgID, id string) (string, []byte, *string, *string, error) {
	if db.DB == nil {
		return "", nil, nil, nil, errors.New("mysql indisponível")
	}
	var title string
	var def []byte
	var brand, template sql.NullString
	err := db.DB.QueryRowContext(ctx,
		`SELECT title, definition_json, brand_id, template_key FROM insight_hub_reports WHERE id = ? AND organization_id = ?`,
		strings.TrimSpace(id), strings.TrimSpace(orgID),
	).Scan(&title, &def, &brand, &template)
	if err != nil {
		return "", nil, nil, nil, err
	}
	var brandPtr, tplPtr *string
	if brand.Valid {
		s := brand.String
		brandPtr = &s
	}
	if template.Valid {
		s := template.String
		tplPtr = &s
	}
	return title, def, brandPtr, tplPtr, nil
}

// DeleteInsightHubReport remove relatório (e schedules apontam para NULL via FK).
func DeleteInsightHubReport(ctx context.Context, orgID, id string) error {
	if db.DB == nil {
		return errors.New("mysql indisponível")
	}
	_, err := db.DB.ExecContext(ctx,
		`DELETE FROM insight_hub_reports WHERE id = ? AND organization_id = ?`,
		strings.TrimSpace(id), strings.TrimSpace(orgID),
	)
	return err
}

// InsightHubScheduledReportRow listagem.
type InsightHubScheduledReportRow struct {
	ID         string   `json:"id"`
	ReportID   *string  `json:"reportId,omitempty"`
	CronExpr   string   `json:"cronExpr"`
	Timezone   string   `json:"timezone"`
	Recipients []string `json:"recipients"`
	NextRunAt  *string  `json:"nextRunAt,omitempty"`
	LastRunAt  *string  `json:"lastRunAt,omitempty"`
	Enabled    bool     `json:"enabled"`
	CreatedAt  string   `json:"createdAt"`
}

// CreateInsightHubScheduledReport regista agendamento.
func CreateInsightHubScheduledReport(
	ctx context.Context, orgID, reportID, cronExpr, timezone, recipientsJSON string, enabled bool, nextRun *time.Time,
) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	id := NewUUID()
	var rid, next interface{}
	if r := strings.TrimSpace(reportID); r != "" {
		rid = r
	}
	if nextRun != nil {
		next = nextRun.UTC().Format("2006-01-02 15:04:05.000")
	}
	en := 0
	if enabled {
		en = 1
	}
	_, err := db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_scheduled_reports (id, organization_id, report_id, cron_expr, timezone, recipients_json, next_run_at, enabled, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, strings.TrimSpace(orgID), rid, strings.TrimSpace(cronExpr), strings.TrimSpace(timezone),
		recipientsJSON, next, en,
	)
	return id, err
}

// ListInsightHubScheduledReports devolve agendamentos da org.
func ListInsightHubScheduledReports(ctx context.Context, orgID string) ([]InsightHubScheduledReportRow, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	rows, err := db.DB.QueryContext(ctx, `
SELECT id, report_id, cron_expr, timezone, recipients_json,
       DATE_FORMAT(next_run_at, '%Y-%m-%dT%H:%i:%sZ'),
       DATE_FORMAT(last_run_at, '%Y-%m-%dT%H:%i:%sZ'),
       enabled, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ')
FROM insight_hub_scheduled_reports WHERE organization_id = ? ORDER BY created_at DESC`, strings.TrimSpace(orgID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InsightHubScheduledReportRow
	for rows.Next() {
		var r InsightHubScheduledReportRow
		var report, next, last sql.NullString
		var recipients []byte
		var en int
		if err := rows.Scan(&r.ID, &report, &r.CronExpr, &r.Timezone, &recipients, &next, &last, &en, &r.CreatedAt); err != nil {
			return nil, err
		}
		if report.Valid {
			s := report.String
			r.ReportID = &s
		}
		if next.Valid {
			s := next.String
			r.NextRunAt = &s
		}
		if last.Valid {
			s := last.String
			r.LastRunAt = &s
		}
		r.Enabled = en != 0
		// recipients_json é array de strings; deixar passar como raw para o front decodificar
		// (limpa eventual JSON quebrado).
		if len(recipients) > 0 && recipients[0] == '[' {
			r.Recipients = parseStringArrayJSON(recipients)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func parseStringArrayJSON(b []byte) []string {
	if len(b) == 0 {
		return nil
	}
	var arr []string
	if err := json.Unmarshal(b, &arr); err != nil {
		return nil
	}
	return arr
}
