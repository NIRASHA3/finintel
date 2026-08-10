package database

import (
	"context"
	"fmt"
	"time"

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
