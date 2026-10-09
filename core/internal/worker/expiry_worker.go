package worker

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/fiqrisr/indico-test/core/internal/repository"
)

type ExpiryWorker struct {
	repo     repository.InventoryRepository
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

func NewExpiryWorker(repo repository.InventoryRepository, interval time.Duration) *ExpiryWorker {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &ExpiryWorker{
		repo:     repo,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start launches the background goroutine ticker that sweeps expired reservations.
func (w *ExpiryWorker) Start(ctx context.Context) {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()

		log.Printf("[Worker] Auto-expiry worker started with interval: %s", w.interval)

		for {
			select {
			case <-ctx.Done():
				log.Println("[Worker] Auto-expiry worker stopped by context")
				return
			case <-w.stopCh:
				log.Println("[Worker] Auto-expiry worker stopped")
				return
			case <-ticker.C:
				w.sweep(ctx)
			}
		}
	}()
}

// Stop signals the worker to exit and waits for the goroutine to finish.
func (w *ExpiryWorker) Stop() {
	close(w.stopCh)
	w.wg.Wait()
}

func (w *ExpiryWorker) sweep(ctx context.Context) {
	sweepCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	affected, err := w.repo.ExpireOldPendingReservations(sweepCtx)
	if err != nil {
		log.Printf("[Worker] Error sweeping expired reservations: %v", err)
		return
	}
	if affected > 0 {
		log.Printf("[Worker] Successfully swept %d expired reservations to EXPIRED", affected)
	}
}
