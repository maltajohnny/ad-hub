package repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// InsightHubMetricPoint linha simplificada para charts.
type InsightHubMetricPoint struct {
	Date       string  `json:"date"`
	MetricKey  string  `json:"metricKey"`
	Value      float64 `json:"value"`
	ConnID     string  `json:"connectionId,omitempty"`
	Provider   string  `json:"provider,omitempty"`
}

// UpsertInsightHubMetricsDaily insere/atualiza métricas em batch (mesmo connection_id).
func UpsertInsightHubMetricsDaily(
	ctx context.Context,
	orgID, brandID, connectionID, provider, externalAccountID string,
	points map[string]map[string]float64, // date -> key -> value
) (int, error) {
	if db.DB == nil {
		return 0, errors.New("mysql indisponível")
	}
	if len(points) == 0 {
		return 0, nil
	}
	rows := 0
	stmt, err := db.DB.PrepareContext(ctx, `
INSERT INTO insight_hub_metrics_daily
  (organization_id, brand_id, connection_id, provider, external_account_id, metric_date, metric_key, metric_value, created_at, updated_at)
VALUES (?, ?, ?, ?, NULLIF(?,''), ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE metric_value = VALUES(metric_value), updated_at = UTC_TIMESTAMP(3)`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	for date, kv := range points {
		for k, v := range kv {
			if _, err := stmt.ExecContext(ctx,
				orgID, brandID, connectionID, provider, externalAccountID, date, k, v,
			); err != nil {
				return rows, err
			}
			rows++
		}
	}
	return rows, nil
}

// SumMetricsByKeyForBrand soma um conjunto de chaves entre datas (inclusivo).
func SumMetricsByKeyForBrand(ctx context.Context, orgID, brandID string, from, to time.Time, keys []string) (map[string]float64, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	if len(keys) == 0 {
		return map[string]float64{}, nil
	}
	placeholders := strings.Repeat("?,", len(keys))
	placeholders = placeholders[:len(placeholders)-1]
	q := fmt.Sprintf(`
SELECT metric_key, COALESCE(SUM(metric_value),0)
FROM insight_hub_metrics_daily
WHERE organization_id = ? AND brand_id = ? AND metric_date BETWEEN ? AND ? AND metric_key IN (%s)
GROUP BY metric_key`, placeholders)

	args := []interface{}{
		strings.TrimSpace(orgID),
		strings.TrimSpace(brandID),
		from.UTC().Format("2006-01-02"),
		to.UTC().Format("2006-01-02"),
	}
	for _, k := range keys {
		args = append(args, k)
	}
	rows, err := db.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]float64, len(keys))
	for rows.Next() {
		var k string
		var v float64
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

// DailyMetricsForBrand devolve série temporal por chave para gráficos.
func DailyMetricsForBrand(
	ctx context.Context, orgID, brandID string, from, to time.Time, keys []string,
) ([]InsightHubMetricPoint, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	if len(keys) == 0 {
		return nil, nil
	}
	placeholders := strings.Repeat("?,", len(keys))
	placeholders = placeholders[:len(placeholders)-1]
	q := fmt.Sprintf(`
SELECT DATE_FORMAT(metric_date, '%%Y-%%m-%%d') AS d, metric_key, SUM(metric_value), connection_id, provider
FROM insight_hub_metrics_daily
WHERE organization_id = ? AND brand_id = ? AND metric_date BETWEEN ? AND ? AND metric_key IN (%s)
GROUP BY d, metric_key, connection_id, provider
ORDER BY d ASC, metric_key ASC`, placeholders)

	args := []interface{}{
		strings.TrimSpace(orgID),
		strings.TrimSpace(brandID),
		from.UTC().Format("2006-01-02"),
		to.UTC().Format("2006-01-02"),
	}
	for _, k := range keys {
		args = append(args, k)
	}
	rows, err := db.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InsightHubMetricPoint
	for rows.Next() {
		var p InsightHubMetricPoint
		var conn, prov sql.NullString
		if err := rows.Scan(&p.Date, &p.MetricKey, &p.Value, &conn, &prov); err != nil {
			return nil, err
		}
		if conn.Valid {
			p.ConnID = conn.String
		}
		if prov.Valid {
			p.Provider = prov.String
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// StartSyncRun cria registo "running" e devolve id para finalizar depois.
func StartSyncRun(ctx context.Context, orgID, brandID, connectionID string) (int64, error) {
	if db.DB == nil {
		return 0, errors.New("mysql indisponível")
	}
	res, err := db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_sync_runs (connection_id, organization_id, brand_id, started_at, status)
VALUES (?, ?, ?, UTC_TIMESTAMP(3), 'running')`,
		strings.TrimSpace(connectionID), strings.TrimSpace(orgID), strings.TrimSpace(brandID),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// FinishSyncRun grava status final + linhas/HTTP calls + erro (truncado).
func FinishSyncRun(ctx context.Context, runID int64, status string, rowsIngested, httpCalls int, errMsg string) {
	if db.DB == nil || runID == 0 {
		return
	}
	if len(errMsg) > 1024 {
		errMsg = errMsg[:1024]
	}
	_, _ = db.DB.ExecContext(ctx, `
UPDATE insight_hub_sync_runs SET
  finished_at = UTC_TIMESTAMP(3),
  status = ?,
  rows_ingested = ?,
  http_calls = ?,
  error_message = NULLIF(?,'')
WHERE id = ?`, strings.TrimSpace(status), rowsIngested, httpCalls, errMsg, runID)
}

// MarkSyncStateAfterRun atualiza connection state para próxima execução.
func MarkSyncStateAfterRun(
	ctx context.Context, connectionID, status string, errMsg string, runOK bool, nextRunIn time.Duration,
) {
	if db.DB == nil || strings.TrimSpace(connectionID) == "" {
		return
	}
	failureExpr := "failure_count + 1"
	if runOK {
		failureExpr = "0"
	}
	if len(errMsg) > 1024 {
		errMsg = errMsg[:1024]
	}
	next := time.Now().UTC().Add(nextRunIn).Format("2006-01-02 15:04:05.000")
	q := fmt.Sprintf(`
UPDATE insight_hub_sync_state SET
  status = ?,
  last_synced_at = CASE WHEN ? = 1 THEN UTC_TIMESTAMP(3) ELSE last_synced_at END,
  next_run_at = ?,
  failure_count = %s,
  last_error = NULLIF(?,''),
  updated_at = UTC_TIMESTAMP(3)
WHERE connection_id = ?`, failureExpr)
	okFlag := 0
	if runOK {
		okFlag = 1
	}
	_, _ = db.DB.ExecContext(ctx, q, strings.TrimSpace(status), okFlag, next, errMsg, strings.TrimSpace(connectionID))
}

// DueSyncJob representa job pronto para correr.
type DueSyncJob struct {
	ConnectionID    string
	OrgID           string
	BrandID         string
	Provider        string
	ExternalAcctID  string
	TokenRef        string
	FailureCount    int
}

// PickDueSyncJobs devolve até `limit` jobs com next_run_at vencido. Aplica throttle por failures.
func PickDueSyncJobs(ctx context.Context, limit int) ([]DueSyncJob, error) {
	if db.DB == nil {
		return nil, errors.New("mysql indisponível")
	}
	if limit <= 0 {
		limit = 10
	}
	rows, err := db.DB.QueryContext(ctx, `
SELECT s.connection_id, s.organization_id, s.brand_id, c.provider, COALESCE(c.external_account_id,''), COALESCE(c.token_ref,''), s.failure_count
FROM insight_hub_sync_state s
JOIN insight_hub_connections c ON c.id = s.connection_id
WHERE (s.next_run_at IS NULL OR s.next_run_at <= UTC_TIMESTAMP(3))
  AND s.status NOT IN ('running')
  AND c.status = 'connected'
ORDER BY s.next_run_at ASC
LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DueSyncJob
	for rows.Next() {
		var j DueSyncJob
		if err := rows.Scan(&j.ConnectionID, &j.OrgID, &j.BrandID, &j.Provider, &j.ExternalAcctID, &j.TokenRef, &j.FailureCount); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}
