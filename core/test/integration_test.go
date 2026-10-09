package test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fiqrisr/inventory-system/core/internal/database"
	"github.com/fiqrisr/inventory-system/core/internal/domain"
	"github.com/fiqrisr/inventory-system/core/internal/repository"
	"github.com/fiqrisr/inventory-system/core/internal/service"
)

func getTestDB(t *testing.T) *sql.DB {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5433/inventory_db?sslmode=disable"
	}

	db, err := database.Connect(dbURL)
	if err != nil {
		t.Skipf("Skipping integration test; PostgreSQL not available at %s: %v", dbURL, err)
	}
	return db
}

func setupTestItem(t *testing.T, db *sql.DB, itemID string, stock int) {
	query := `
		INSERT INTO inventory (item_id, total_stock, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (item_id) DO UPDATE 
		SET total_stock = EXCLUDED.total_stock, updated_at = NOW();
	`
	_, err := db.Exec(query, itemID, stock)
	require.NoError(t, err)

	// Clean any previous reservations for this test item
	_, err = db.Exec("DELETE FROM reservations WHERE item_id = $1", itemID)
	require.NoError(t, err)
}

func TestConcurrentReservations_PessimisticLocking(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)

	testItemID := "flash-sale-item-" + uuid.NewString()[:8]
	initialStock := 10
	concurrentRequests := 50

	setupTestItem(t, db, testItemID, initialStock)

	var (
		successCount atomic.Int64
		failCount    atomic.Int64
		wg           sync.WaitGroup
		successIDs   sync.Map
	)

	startGate := make(chan struct{})

	// Spin up 50 concurrent requests competing for 10 items
	for i := 0; i < concurrentRequests; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-startGate // Synchronize start for maximum concurrency race

			userID := fmt.Sprintf("user-%d", idx)
			resp, err := svc.ReserveStock(context.Background(), domain.ReserveStockRequest{
				UserID:   userID,
				ItemID:   testItemID,
				Quantity: 1,
			})

			if err == nil {
				successCount.Add(1)
				successIDs.Store(resp.ReservationID, true)
			} else if err == domain.ErrInsufficientStock {
				failCount.Add(1)
			} else {
				t.Errorf("Unexpected error for goroutine %d: %v", idx, err)
			}
		}(i)
	}

	// Release all goroutines simultaneously
	close(startGate)
	wg.Wait()

	assert.Equal(t, int64(initialStock), successCount.Load(), "Exactly initialStock reservations must succeed")
	assert.Equal(t, int64(concurrentRequests-initialStock), failCount.Load(), "Remaining requests must fail with insufficient stock")

	// Verify stock state in DB
	stockResp, err := svc.GetStock(context.Background(), testItemID)
	require.NoError(t, err)
	assert.Equal(t, initialStock, stockResp.TotalStock)
	assert.Equal(t, initialStock, stockResp.ReservedStock)
	assert.Equal(t, 0, stockResp.AvailableStock)

	// Now concurrently confirm all successful reservations
	var confirmSuccessCount atomic.Int64
	var confirmWg sync.WaitGroup

	successIDs.Range(func(key, value any) bool {
		resID := key.(string)
		confirmWg.Add(1)
		go func(id string) {
			defer confirmWg.Done()
			_, err := svc.ConfirmReservation(context.Background(), domain.ConfirmReservationRequest{
				ReservationID: id,
			})
			if err == nil {
				confirmSuccessCount.Add(1)
			}
		}(resID)
		return true
	})

	confirmWg.Wait()

	assert.Equal(t, int64(initialStock), confirmSuccessCount.Load(), "All 10 reservations must be confirmed")

	// Verify inventory after confirmation
	stockAfterConfirm, err := svc.GetStock(context.Background(), testItemID)
	require.NoError(t, err)
	assert.Equal(t, 0, stockAfterConfirm.TotalStock, "Total stock must be decremented to 0")
	assert.Equal(t, 0, stockAfterConfirm.ReservedStock, "Reserved stock must be 0")
	assert.Equal(t, 0, stockAfterConfirm.AvailableStock, "Available stock must be 0")

	// Verifying duplicate confirmation fails
	successIDs.Range(func(key, value any) bool {
		resID := key.(string)
		_, err := svc.ConfirmReservation(context.Background(), domain.ConfirmReservationRequest{
			ReservationID: resID,
		})
		assert.ErrorIs(t, err, domain.ErrReservationNotPending)
		return false // test one
	})
}

func TestReservationExpiryAndRelease(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)

	testItemID := "expiry-test-item-" + uuid.NewString()[:8]
	setupTestItem(t, db, testItemID, 5)

	// Insert an already expired reservation directly
	expiredResID := "expired-res-" + uuid.NewString()[:8]
	pastTime := time.Now().UTC().Add(-10 * time.Minute)
	_, err := db.Exec(`
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
	`, expiredResID, "user-expired", testItemID, 5, pastTime, pastTime)
	require.NoError(t, err)

	// Since expires_at < NOW(), the stock must NOT be considered reserved
	stockResp, err := svc.GetStock(context.Background(), testItemID)
	require.NoError(t, err)
	assert.Equal(t, 5, stockResp.TotalStock)
	assert.Equal(t, 0, stockResp.ReservedStock, "Expired pending reservations should not count towards reserved stock")
	assert.Equal(t, 5, stockResp.AvailableStock)

	// 1. Run auto-expiry sweep to transition past-due reservations to EXPIRED
	sweptCount, err := repo.ExpireOldPendingReservations(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, sweptCount, int64(1), "Auto-expiry sweep should update at least 1 reservation")

	// Verify reservation status is now EXPIRED
	var status string
	err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", expiredResID).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, string(domain.ReservationStatusExpired), status)

	// Attempting to confirm the swept reservation must fail with ErrReservationExpired
	_, err = svc.ConfirmReservation(context.Background(), domain.ConfirmReservationRequest{
		ReservationID: expiredResID,
	})
	assert.ErrorIs(t, err, domain.ErrReservationExpired)

	// 2. Also test an un-swept expired reservation confirmed directly (in-flight expiry check)
	expiredResID2 := "expired-res2-" + uuid.NewString()[:8]
	_, err = db.Exec(`
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
	`, expiredResID2, "user-expired2", testItemID, 1, pastTime, pastTime)
	require.NoError(t, err)

	_, err = svc.ConfirmReservation(context.Background(), domain.ConfirmReservationRequest{
		ReservationID: expiredResID2,
	})
	assert.ErrorIs(t, err, domain.ErrReservationExpired)
}
