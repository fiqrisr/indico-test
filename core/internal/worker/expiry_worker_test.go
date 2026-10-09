package worker_test

import (
	"context"
	"database/sql"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/fiqrisr/inventory-system/core/internal/domain"
	"github.com/fiqrisr/inventory-system/core/internal/worker"
)

type mockWorkerRepo struct {
	expireCount atomic.Int64
}

func (m *mockWorkerRepo) BeginTx(ctx context.Context) (*sql.Tx, error) {
	return nil, nil
}

func (m *mockWorkerRepo) GetInventoryForUpdate(ctx context.Context, tx *sql.Tx, itemID string) (*domain.Inventory, error) {
	return nil, nil
}

func (m *mockWorkerRepo) GetActiveReservedStock(ctx context.Context, tx *sql.Tx, itemID string) (int, error) {
	return 0, nil
}

func (m *mockWorkerRepo) CreateReservation(ctx context.Context, tx *sql.Tx, res *domain.Reservation) error {
	return nil
}

func (m *mockWorkerRepo) GetReservationForUpdate(ctx context.Context, tx *sql.Tx, reservationID string) (*domain.Reservation, error) {
	return nil, nil
}

func (m *mockWorkerRepo) UpdateReservationStatus(ctx context.Context, tx *sql.Tx, reservationID string, status domain.ReservationStatus) error {
	return nil
}

func (m *mockWorkerRepo) DecrementInventoryStock(ctx context.Context, tx *sql.Tx, itemID string, quantity int) error {
	return nil
}

func (m *mockWorkerRepo) GetInventoryStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
	return nil, nil
}

func (m *mockWorkerRepo) ExpireOldPendingReservations(ctx context.Context) (int64, error) {
	m.expireCount.Add(1)
	return 2, nil
}

func TestExpiryWorker_StartAndStop(t *testing.T) {
	mockRepo := &mockWorkerRepo{}
	w := worker.NewExpiryWorker(mockRepo, 25*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	w.Start(ctx)

	// Allow worker to tick a few times
	time.Sleep(80 * time.Millisecond)
	w.Stop()

	assert.GreaterOrEqual(t, mockRepo.expireCount.Load(), int64(1), "Expected worker to execute at least one sweep")
}
