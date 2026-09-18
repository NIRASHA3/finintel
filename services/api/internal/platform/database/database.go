package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB interface {
	Ping(ctx context.Context) error
	Close()
	Pool() *pgxpool.Pool
}

type PostgresDB struct {
	pool *pgxpool.Pool
}

func NewPostgresPool(ctx context.Context, connString string, maxConns int32) (*PostgresDB, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database connString: %w", err)
	}

	if maxConns > 0 {
		config.MaxConns = maxConns
	}

	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		var sessionUser string
		var sessionSuperuser, sessionBypassRLS bool
		err := conn.QueryRow(ctx, `
			SELECT session_user, rolsuper, rolbypassrls
			FROM pg_roles
			WHERE rolname = session_user;
		`).Scan(&sessionUser, &sessionSuperuser, &sessionBypassRLS)
		if err != nil {
			return fmt.Errorf("failed to verify database login role: %w", err)
		}
		if sessionSuperuser || sessionBypassRLS {
			return fmt.Errorf("database login role '%s' must not be superuser or BYPASSRLS", sessionUser)
		}

		_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
		if err != nil {
			return fmt.Errorf("failed to execute SET ROLE finintel_app on connection: %w", err)
		}
		var currentUser string
		err = conn.QueryRow(ctx, "SELECT current_user, session_user;").Scan(&currentUser, &sessionUser)
		if err != nil {
			return fmt.Errorf("failed to verify current_user on connection: %w", err)
		}
		if currentUser != "finintel_app" {
			return fmt.Errorf("connection current_user is '%s', expected 'finintel_app'", currentUser)
		}
		return nil
	}

	initCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(initCtx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create database pool: %w", err)
	}

	pingCtx, pingCancel := context.WithTimeout(ctx, 3*time.Second)
	defer pingCancel()

	if err := pool.Ping(pingCtx); err != nil {
		// Log warning or return pool for graceful degradation support in health checks
		// Note: We return pool even if offline so /health/ready can report 503 instead of process crash
	}

	return &PostgresDB{pool: pool}, nil
}

func (db *PostgresDB) Ping(ctx context.Context) error {
	if db == nil || db.pool == nil {
		return fmt.Errorf("database pool is uninitialized")
	}
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return db.pool.Ping(pingCtx)
}

func (db *PostgresDB) Close() {
	if db != nil && db.pool != nil {
		db.pool.Close()
	}
}

func (db *PostgresDB) Pool() *pgxpool.Pool {
	if db == nil {
		return nil
	}
	return db.pool
}
