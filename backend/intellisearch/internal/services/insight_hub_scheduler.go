package services

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"norter/intellisearch/internal/db"
	"norter/intellisearch/internal/repo"
)

var schedulerStarted struct {
	once sync.Once
	cancel context.CancelFunc
}

// StartInsightHubScheduler arranca uma goroutine que a cada `interval` puxa jobs vencidos e executa o sync.
// Idempotente — chamar uma vez no main.go.
func StartInsightHubScheduler(interval time.Duration, batchSize int) {
	schedulerStarted.once.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		schedulerStarted.cancel = cancel
		go schedulerLoop(ctx, interval, batchSize)
	})
}

// StopInsightHubScheduler termina o loop (usado em testes ou shutdown ordenado).
func StopInsightHubScheduler() {
	if schedulerStarted.cancel != nil {
		schedulerStarted.cancel()
	}
}

func schedulerLoop(ctx context.Context, interval time.Duration, batchSize int) {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 5
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	log.Printf("insight_hub: scheduler iniciado (interval=%s, batch=%d)", interval, batchSize)
	for {
		select {
		case <-ctx.Done():
			log.Printf("insight_hub: scheduler terminado")
			return
		case <-t.C:
			if db.DB == nil {
				continue
			}
			runDueJobs(ctx, batchSize)
			_ = repo.CleanupExpiredOAuthStates(ctx)
		}
	}
}

func runDueJobs(ctx context.Context, batchSize int) {
	jobs, err := repo.PickDueSyncJobs(ctx, batchSize)
	if err != nil {
		log.Printf("insight_hub: PickDueSyncJobs erro: %v", err)
		return
	}
	if len(jobs) == 0 {
		return
	}
	for _, j := range jobs {
		runJob(ctx, j)
	}
}

func runJob(ctx context.Context, j repo.DueSyncJob) {
	runID, err := repo.StartSyncRun(ctx, j.OrgID, j.BrandID, j.ConnectionID)
	if err != nil {
		log.Printf("insight_hub: StartSyncRun erro: %v", err)
		return
	}
	defer recoverJob(ctx, j, runID)

	provider := strings.TrimSpace(strings.ToLower(j.Provider))
	if j.TokenRef == "" {
		repo.FinishSyncRun(ctx, runID, "error", 0, 0, "token_ref vazio")
		repo.MarkSyncStateAfterRun(ctx, j.ConnectionID, "error", "token_ref vazio", false, backoff(j.FailureCount))
		return
	}
	plain, err := repo.GetInsightHubSecret(ctx, j.OrgID, j.TokenRef)
	if err != nil {
		repo.FinishSyncRun(ctx, runID, "error", 0, 0, "segredo indisponível")
		repo.MarkSyncStateAfterRun(ctx, j.ConnectionID, "error", "segredo indisponível", false, backoff(j.FailureCount))
		return
	}
	token := strings.TrimSpace(string(plain))

	jobCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	var outcome MetaSyncOutcome
	switch provider {
	case "facebook_insights":
		outcome, err = SyncFacebookPage(jobCtx, j.OrgID, j.BrandID, j.ConnectionID, j.ExternalAcctID, token)
	case "meta_ads":
		outcome, err = SyncMetaAdAccount(jobCtx, j.OrgID, j.BrandID, j.ConnectionID, j.ExternalAcctID, token)
	default:
		err = errSchedulerUnsupportedProvider(provider)
	}

	if err != nil {
		repo.FinishSyncRun(ctx, runID, "error", outcome.RowsIngested, outcome.HTTPCalls, err.Error())
		repo.MarkSyncStateAfterRun(ctx, j.ConnectionID, "error", err.Error(), false, backoff(j.FailureCount))
		return
	}
	repo.FinishSyncRun(ctx, runID, "success", outcome.RowsIngested, outcome.HTTPCalls, "")
	next := outcome.NextRunIn
	if next <= 0 {
		next = 6 * time.Hour
	}
	repo.MarkSyncStateAfterRun(ctx, j.ConnectionID, "idle", "", true, next)
}

func recoverJob(ctx context.Context, j repo.DueSyncJob, runID int64) {
	if r := recover(); r != nil {
		log.Printf("insight_hub: panic em job %s: %v", j.ConnectionID, r)
		repo.FinishSyncRun(ctx, runID, "error", 0, 0, "panic")
		repo.MarkSyncStateAfterRun(ctx, j.ConnectionID, "error", "panic", false, backoff(j.FailureCount))
	}
}

func backoff(failures int) time.Duration {
	if failures <= 0 {
		return 30 * time.Minute
	}
	if failures > 6 {
		failures = 6
	}
	return time.Duration(15*(1<<failures)) * time.Minute
}

type schedulerError struct{ msg string }

func (e *schedulerError) Error() string { return e.msg }

func errSchedulerUnsupportedProvider(p string) error {
	return &schedulerError{msg: "provedor não suportado: " + p}
}
