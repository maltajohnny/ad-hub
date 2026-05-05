package repo

import (
	"context"
	"database/sql"
	"time"

	"norter/intellisearch/internal/db"
)

type AuthLockState struct {
	FailCount int
	LockUntil sql.NullTime
}

func EnsureAdHubAuthSecurityTables(ctx context.Context, db *sql.DB) error {
	const qState = `
CREATE TABLE IF NOT EXISTS adhub_auth_security_state (
  action VARCHAR(40) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  identifier VARCHAR(191) NOT NULL,
  fail_count INT NOT NULL DEFAULT 0,
  lock_until DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (action, ip, identifier),
  KEY idx_adhub_auth_security_lock_until (lock_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	if _, err := db.ExecContext(ctx, qState); err != nil {
		return err
	}

	const qEvents = `
CREATE TABLE IF NOT EXISTS adhub_auth_security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  action VARCHAR(40) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  identifier VARCHAR(191) NOT NULL,
  outcome VARCHAR(24) NOT NULL,
  reason VARCHAR(120) NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_adhub_auth_events_created (created_at),
  KEY idx_adhub_auth_events_action_identifier (action, identifier, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	_, err := db.ExecContext(ctx, qEvents)
	return err
}

func GetAuthLockState(ctx context.Context, action, ip, identifier string) (AuthLockState, error) {
	if db.DB == nil {
		return AuthLockState{}, sql.ErrConnDone
	}
	var out AuthLockState
	err := db.DB.QueryRowContext(
		ctx,
		`SELECT fail_count, lock_until FROM adhub_auth_security_state WHERE action = ? AND ip = ? AND identifier = ?`,
		action, ip, identifier,
	).Scan(&out.FailCount, &out.LockUntil)
	if err == sql.ErrNoRows {
		return AuthLockState{}, nil
	}
	return out, err
}

func RecordAuthEvent(ctx context.Context, action, ip, identifier, outcome, reason, userAgent string) error {
	if db.DB == nil {
		return sql.ErrConnDone
	}
	_, err := db.DB.ExecContext(
		ctx,
		`INSERT INTO adhub_auth_security_events (action, ip, identifier, outcome, reason, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
		action, ip, identifier, outcome, nullString(reason), nullString(userAgent),
	)
	return err
}

func RecordAuthSuccess(ctx context.Context, action, ip, identifier, userAgent string) error {
	if db.DB == nil {
		return sql.ErrConnDone
	}
	now := time.Now().UTC()
	if _, err := db.DB.ExecContext(
		ctx,
		`INSERT INTO adhub_auth_security_state (action, ip, identifier, fail_count, lock_until, updated_at)
		 VALUES (?, ?, ?, 0, NULL, ?)
		 ON DUPLICATE KEY UPDATE fail_count = 0, lock_until = NULL, updated_at = VALUES(updated_at)`,
		action, ip, identifier, now,
	); err != nil {
		return err
	}
	return RecordAuthEvent(ctx, action, ip, identifier, "success", "", userAgent)
}

func RecordAuthFailure(ctx context.Context, action, ip, identifier, reason, userAgent string) (time.Time, int, error) {
	if db.DB == nil {
		return time.Time{}, 0, sql.ErrConnDone
	}
	tx, err := db.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return time.Time{}, 0, err
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now().UTC()
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO adhub_auth_security_state (action, ip, identifier, fail_count, lock_until, updated_at)
		 VALUES (?, ?, ?, 0, NULL, ?)
		 ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
		action, ip, identifier, now,
	); err != nil {
		return time.Time{}, 0, err
	}

	var state AuthLockState
	if err := tx.QueryRowContext(
		ctx,
		`SELECT fail_count, lock_until FROM adhub_auth_security_state WHERE action = ? AND ip = ? AND identifier = ? FOR UPDATE`,
		action, ip, identifier,
	).Scan(&state.FailCount, &state.LockUntil); err != nil {
		return time.Time{}, 0, err
	}

	nextCount := state.FailCount + 1
	nextLock := progressiveLockUntil(now, nextCount)
	if state.LockUntil.Valid && state.LockUntil.Time.After(nextLock) {
		nextLock = state.LockUntil.Time
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE adhub_auth_security_state SET fail_count = ?, lock_until = ?, updated_at = ? WHERE action = ? AND ip = ? AND identifier = ?`,
		nextCount, nextLock, now, action, ip, identifier,
	); err != nil {
		return time.Time{}, 0, err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO adhub_auth_security_events (action, ip, identifier, outcome, reason, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
		action, ip, identifier, "failure", nullString(reason), nullString(userAgent),
	); err != nil {
		return time.Time{}, 0, err
	}

	if err := tx.Commit(); err != nil {
		return time.Time{}, 0, err
	}
	return nextLock, nextCount, nil
}

func progressiveLockUntil(now time.Time, count int) time.Time {
	switch {
	case count >= 20:
		return now.Add(24 * time.Hour)
	case count >= 12:
		return now.Add(1 * time.Hour)
	case count >= 8:
		return now.Add(15 * time.Minute)
	case count >= 5:
		return now.Add(5 * time.Minute)
	default:
		return time.Time{}
	}
}
