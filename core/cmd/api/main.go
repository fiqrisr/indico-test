package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fiqrisr/inventory-system/core/internal/config"
	"github.com/fiqrisr/inventory-system/core/internal/database"
	"github.com/fiqrisr/inventory-system/core/internal/handler"
	"github.com/fiqrisr/inventory-system/core/internal/repository"
	"github.com/fiqrisr/inventory-system/core/internal/service"
	"github.com/fiqrisr/inventory-system/core/internal/worker"
)

func main() {
	cfg := config.Load()
	log.Printf("Starting inventory service on port %s...", cfg.Port)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			log.Printf("Error closing database: %v", err)
		} else {
			log.Println("Database connection closed cleanly")
		}
	}()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, cfg.ReservationExpiryDuration)
	h := handler.NewInventoryHandler(svc)
	router := handler.SetupRouter(h, cfg.GinMode)

	// Context for background workers and graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start auto-expiry worker
	expiryWorker := worker.NewExpiryWorker(repo, cfg.ExpiryInterval)
	expiryWorker.Start(ctx)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	// Server run in separate goroutine
	go func() {
		log.Printf("Server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server listen error: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("Received signal %s, initiating graceful shutdown...", sig)

	// Stop background worker
	expiryWorker.Stop()
	cancel()

	// Shutdown HTTP server with 10s timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
