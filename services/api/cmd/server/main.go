package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
	"github.com/NIRASHA3/finintel/services/api/internal/platform/database"
	transportHTTP "github.com/NIRASHA3/finintel/services/api/internal/transport/http"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load environment configuration", slog.Any("error", err))
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.SlogLevel(),
	}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := database.NewPostgresPool(ctx, cfg.DatabaseURL, cfg.DatabaseMaxConns)
	if err != nil {
		logger.Warn("unable to initialize PostgreSQL connection pool on startup", slog.Any("error", err))
	} else if db != nil {
		defer db.Close()
	}

	router := transportHTTP.NewRouter(db, logger)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverCtx, serverStopCtx := context.WithCancel(context.Background())
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sig
		logger.Info("received termination signal, initiating graceful shutdown")

		shutdownCtx, shutdownCancel := context.WithTimeout(serverCtx, 10*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("HTTP server graceful shutdown failed", slog.Any("error", err))
		}

		serverStopCtx()
	}()

	logger.Info("starting FinIntel Core API server", slog.String("addr", addr), slog.String("env", cfg.Env))

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("HTTP server listen error", slog.Any("error", err))
		os.Exit(1)
	}

	<-serverCtx.Done()
	logger.Info("server shutdown complete")
}
