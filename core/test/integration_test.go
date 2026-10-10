package test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fiqrisr/indico-test/core/internal/database"
	"github.com/fiqrisr/indico-test/core/internal/domain"
	"github.com/fiqrisr/indico-test/core/internal/handler"
	"github.com/fiqrisr/indico-test/core/internal/repository"
	"github.com/fiqrisr/indico-test/core/internal/service"
)

func getTestDB(t *testing.T) *sql.DB {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5433/indico_test_db?sslmode=disable"
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
			} else if errors.Is(err, domain.ErrInsufficientStock) {
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

func TestReserveStock_Integration(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)
	ctx := context.Background()

	t.Run("Positive_SingleReservation", func(t *testing.T) {
		itemID := "reserve-single-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 10)

		resp, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-single",
			ItemID:   itemID,
			Quantity: 2,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resp.ReservationID)
		assert.Equal(t, itemID, resp.ItemID)
		assert.Equal(t, 2, resp.Quantity)
		assert.True(t, resp.ExpiresAt.After(time.Now().UTC()))

		// Verify stock reflection
		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 10, stock.TotalStock)
		assert.Equal(t, 2, stock.ReservedStock)
		assert.Equal(t, 8, stock.AvailableStock)

		// Verify database row
		var dbUserID, dbStatus string
		var dbQty int
		err = db.QueryRow("SELECT user_id, quantity, status FROM reservations WHERE reservation_id = $1", resp.ReservationID).
			Scan(&dbUserID, &dbQty, &dbStatus)
		require.NoError(t, err)
		assert.Equal(t, "user-single", dbUserID)
		assert.Equal(t, 2, dbQty)
		assert.Equal(t, string(domain.ReservationStatusPending), dbStatus)
	})

	t.Run("Positive_MultipleSequentialReservations", func(t *testing.T) {
		itemID := "reserve-seq-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 10)

		res1, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-seq-1",
			ItemID:   itemID,
			Quantity: 3,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, res1.ReservationID)

		res2, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-seq-2",
			ItemID:   itemID,
			Quantity: 4,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, res2.ReservationID)

		res3, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-seq-3",
			ItemID:   itemID,
			Quantity: 3,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, res3.ReservationID)

		// Full stock now reserved (3 + 4 + 3 = 10)
		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 10, stock.TotalStock)
		assert.Equal(t, 10, stock.ReservedStock)
		assert.Equal(t, 0, stock.AvailableStock)

		// Next request must fail
		_, err = svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-seq-4",
			ItemID:   itemID,
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrInsufficientStock)
	})

	t.Run("Positive_MultiQuantityExactStock", func(t *testing.T) {
		itemID := "reserve-exact-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		resp, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-exact",
			ItemID:   itemID,
			Quantity: 5,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resp.ReservationID)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 5, stock.TotalStock)
		assert.Equal(t, 5, stock.ReservedStock)
		assert.Equal(t, 0, stock.AvailableStock)
	})

	t.Run("Negative_ItemNotFound", func(t *testing.T) {
		nonExistentID := "non-existent-" + uuid.NewString()
		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   nonExistentID,
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrItemNotFound)
	})

	t.Run("Negative_InsufficientStock_RequestedExceedsTotal", func(t *testing.T) {
		itemID := "reserve-exceed-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   itemID,
			Quantity: 6,
		})
		assert.ErrorIs(t, err, domain.ErrInsufficientStock)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 5, stock.AvailableStock)
	})

	t.Run("Negative_InsufficientStock_ZeroTotalStock", func(t *testing.T) {
		itemID := "reserve-zero-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 0)

		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   itemID,
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrInsufficientStock)
	})

	t.Run("Negative_InsufficientStock_AlreadyReserved", func(t *testing.T) {
		itemID := "reserve-allres-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 2)

		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   itemID,
			Quantity: 2,
		})
		require.NoError(t, err)

		_, err = svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-2",
			ItemID:   itemID,
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrInsufficientStock)
	})

	t.Run("Negative_InvalidInput", func(t *testing.T) {
		tests := []struct {
			name string
			req  domain.ReserveStockRequest
		}{
			{"empty_item_id", domain.ReserveStockRequest{UserID: "u1", ItemID: "", Quantity: 1}},
			{"whitespace_item_id", domain.ReserveStockRequest{UserID: "u1", ItemID: "   ", Quantity: 1}},
			{"empty_user_id", domain.ReserveStockRequest{UserID: "", ItemID: "item-1", Quantity: 1}},
			{"whitespace_user_id", domain.ReserveStockRequest{UserID: "   ", ItemID: "item-1", Quantity: 1}},
			{"zero_quantity", domain.ReserveStockRequest{UserID: "u1", ItemID: "item-1", Quantity: 0}},
			{"negative_quantity", domain.ReserveStockRequest{UserID: "u1", ItemID: "item-1", Quantity: -3}},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				_, err := svc.ReserveStock(ctx, tc.req)
				assert.ErrorIs(t, err, domain.ErrInvalidInput)
			})
		}
	})
}

func TestConfirmReservation_Integration(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)
	ctx := context.Background()

	t.Run("Positive_ConfirmPendingReservation", func(t *testing.T) {
		itemID := "confirm-pos-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 10)

		res, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-confirm",
			ItemID:   itemID,
			Quantity: 3,
		})
		require.NoError(t, err)

		confirmResp, err := svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, confirmResp.Status)
		assert.Equal(t, res.ReservationID, confirmResp.ReservationID)
		assert.False(t, confirmResp.ConfirmedAt.IsZero())

		// Verify database row is CONFIRMED
		var status string
		err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", res.ReservationID).Scan(&status)
		require.NoError(t, err)
		assert.Equal(t, string(domain.ReservationStatusConfirmed), status)

		// Verify inventory physical stock was decremented and reserved stock cleared
		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 7, stock.TotalStock, "Total stock must be decremented by reserved quantity")
		assert.Equal(t, 0, stock.ReservedStock, "Reserved stock must be 0 after confirmation")
		assert.Equal(t, 7, stock.AvailableStock, "Available stock must match updated total stock")
	})

	t.Run("Negative_ReservationNotFound", func(t *testing.T) {
		_, err := svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: uuid.NewString(),
		})
		assert.ErrorIs(t, err, domain.ErrReservationNotFound)
	})

	t.Run("Negative_InvalidInput_EmptyReservationID", func(t *testing.T) {
		for _, invalidID := range []string{"", "   "} {
			_, err := svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
				ReservationID: invalidID,
			})
			assert.ErrorIs(t, err, domain.ErrInvalidInput)
		}
	})

	t.Run("Negative_AlreadyConfirmed", func(t *testing.T) {
		itemID := "confirm-dup-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		res, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-dup",
			ItemID:   itemID,
			Quantity: 1,
		})
		require.NoError(t, err)

		// First confirmation succeeds
		_, err = svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		require.NoError(t, err)

		// Second confirmation fails with ErrReservationNotPending
		_, err = svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		assert.ErrorIs(t, err, domain.ErrReservationNotPending)
	})

	t.Run("Negative_ExpiredSwept", func(t *testing.T) {
		itemID := "confirm-exp-swept-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		expID := "swept-exp-" + uuid.NewString()[:8]
		pastTime := time.Now().UTC().Add(-10 * time.Minute)
		_, err := db.Exec(`
			INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
			VALUES ($1, $2, $3, $4, 'EXPIRED', $5, $6)
		`, expID, "user-exp", itemID, 2, pastTime, pastTime)
		require.NoError(t, err)

		_, err = svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: expID,
		})
		assert.ErrorIs(t, err, domain.ErrReservationExpired)
	})

	t.Run("Negative_ExpiredInFlight", func(t *testing.T) {
		itemID := "confirm-exp-inflight-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		expID := "inflight-exp-" + uuid.NewString()[:8]
		pastTime := time.Now().UTC().Add(-5 * time.Minute)
		_, err := db.Exec(`
			INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
			VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
		`, expID, "user-inflight", itemID, 2, pastTime, pastTime)
		require.NoError(t, err)

		_, err = svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: expID,
		})
		assert.ErrorIs(t, err, domain.ErrReservationExpired)

		// Status must have been transitioned to EXPIRED in DB
		var status string
		err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", expID).Scan(&status)
		require.NoError(t, err)
		assert.Equal(t, string(domain.ReservationStatusExpired), status)
	})

	t.Run("Negative_ConcurrentDuplicateConfirmationRace", func(t *testing.T) {
		itemID := "confirm-race-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		res, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-race",
			ItemID:   itemID,
			Quantity: 2,
		})
		require.NoError(t, err)

		var (
			successCount atomic.Int64
			failCount    atomic.Int64
			wg           sync.WaitGroup
			startGate    = make(chan struct{})
		)

		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-startGate

				_, cErr := svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
					ReservationID: res.ReservationID,
				})
				if cErr == nil {
					successCount.Add(1)
				} else if errors.Is(cErr, domain.ErrReservationNotPending) {
					failCount.Add(1)
				}
			}()
		}

		close(startGate)
		wg.Wait()

		assert.Equal(t, int64(1), successCount.Load(), "Exactly 1 concurrent confirmation must succeed")
		assert.Equal(t, int64(1), failCount.Load(), "Competing duplicate confirmation must fail with ErrReservationNotPending")
	})
}

func TestGetStock_Integration(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)
	ctx := context.Background()

	t.Run("Positive_InitialStockNoReservations", func(t *testing.T) {
		itemID := "stock-init-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 20)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, stock.Status)
		assert.Equal(t, itemID, stock.ItemID)
		assert.Equal(t, 20, stock.TotalStock)
		assert.Equal(t, 0, stock.ReservedStock)
		assert.Equal(t, 20, stock.AvailableStock)
	})

	t.Run("Positive_WithPendingReservations", func(t *testing.T) {
		itemID := "stock-pending-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 20)

		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "u1",
			ItemID:   itemID,
			Quantity: 7,
		})
		require.NoError(t, err)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 20, stock.TotalStock)
		assert.Equal(t, 7, stock.ReservedStock)
		assert.Equal(t, 13, stock.AvailableStock)
	})

	t.Run("Positive_WithExpiredReservations", func(t *testing.T) {
		itemID := "stock-exp-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 20)

		// Insert expired reservation
		pastTime := time.Now().UTC().Add(-10 * time.Minute)
		_, err := db.Exec(`
			INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
			VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
		`, "res-exp-"+uuid.NewString()[:8], "u-exp", itemID, 5, pastTime, pastTime)
		require.NoError(t, err)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 20, stock.TotalStock)
		assert.Equal(t, 0, stock.ReservedStock, "Expired reservation must not count in reserved stock")
		assert.Equal(t, 20, stock.AvailableStock)
	})

	t.Run("Positive_AfterConfirmation", func(t *testing.T) {
		itemID := "stock-confirmed-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 15)

		res, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "u1",
			ItemID:   itemID,
			Quantity: 5,
		})
		require.NoError(t, err)

		_, err = svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		require.NoError(t, err)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 10, stock.TotalStock)
		assert.Equal(t, 0, stock.ReservedStock)
		assert.Equal(t, 10, stock.AvailableStock)
	})

	t.Run("Positive_ZeroStockItem", func(t *testing.T) {
		itemID := "stock-zero-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 0)

		stock, err := svc.GetStock(ctx, itemID)
		require.NoError(t, err)
		assert.Equal(t, 0, stock.TotalStock)
		assert.Equal(t, 0, stock.ReservedStock)
		assert.Equal(t, 0, stock.AvailableStock)
	})

	t.Run("Negative_ItemNotFound", func(t *testing.T) {
		_, err := svc.GetStock(ctx, "non-existent-"+uuid.NewString())
		assert.ErrorIs(t, err, domain.ErrItemNotFound)
	})

	t.Run("Negative_InvalidInput", func(t *testing.T) {
		for _, invalidID := range []string{"", "   "} {
			_, err := svc.GetStock(ctx, invalidID)
			assert.ErrorIs(t, err, domain.ErrInvalidInput)
		}
	})
}

func TestExpireOldPendingReservations_Integration(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	ctx := context.Background()

	itemID := "sweep-test-" + uuid.NewString()[:8]
	setupTestItem(t, db, itemID, 20)

	pastTime := time.Now().UTC().Add(-10 * time.Minute)
	futureTime := time.Now().UTC().Add(10 * time.Minute)

	resExpired1 := "sweep-exp1-" + uuid.NewString()[:8]
	resExpired2 := "sweep-exp2-" + uuid.NewString()[:8]
	resActive := "sweep-act-" + uuid.NewString()[:8]
	resConfirmed := "sweep-conf-" + uuid.NewString()[:8]

	// Insert 2 expired PENDING reservations
	_, err := db.Exec(`
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'PENDING', $5, $6), ($7, $8, $9, $10, 'PENDING', $11, $12)
	`, resExpired1, "u1", itemID, 2, pastTime, pastTime,
		resExpired2, "u2", itemID, 3, pastTime, pastTime)
	require.NoError(t, err)

	// Insert 1 active PENDING reservation (expires in future)
	_, err = db.Exec(`
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
	`, resActive, "u3", itemID, 2, futureTime, time.Now().UTC())
	require.NoError(t, err)

	// Insert 1 CONFIRMED reservation
	_, err = db.Exec(`
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6)
	`, resConfirmed, "u4", itemID, 1, pastTime, pastTime)
	require.NoError(t, err)

	// Run sweep
	swept, err := repo.ExpireOldPendingReservations(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, swept, int64(2))

	// Verify the 2 expired reservations became EXPIRED
	for _, id := range []string{resExpired1, resExpired2} {
		var status string
		err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", id).Scan(&status)
		require.NoError(t, err)
		assert.Equal(t, string(domain.ReservationStatusExpired), status)
	}

	// Verify active reservation is still PENDING
	var actStatus string
	err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", resActive).Scan(&actStatus)
	require.NoError(t, err)
	assert.Equal(t, string(domain.ReservationStatusPending), actStatus)

	// Verify confirmed reservation is still CONFIRMED
	var confStatus string
	err = db.QueryRow("SELECT status FROM reservations WHERE reservation_id = $1", resConfirmed).Scan(&confStatus)
	require.NoError(t, err)
	assert.Equal(t, string(domain.ReservationStatusConfirmed), confStatus)

	// Running sweep again immediately should find 0 expired reservations for this item
	sweptSecond, err := repo.ExpireOldPendingReservations(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), sweptSecond)
}

func TestHTTPAPI_Integration(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := repository.NewPostgresRepository(db)
	svc := service.NewInventoryService(repo, 5*time.Minute)
	h := handler.NewInventoryHandler(svc)
	router := handler.SetupRouter(h, "release")

	doRequest := func(method, path string, body any) *httptest.ResponseRecorder {
		var reqBody io.Reader
		if body != nil {
			switch b := body.(type) {
			case []byte:
				reqBody = bytes.NewReader(b)
			case string:
				reqBody = strings.NewReader(b)
			default:
				jsonBytes, err := json.Marshal(body)
				require.NoError(t, err)
				reqBody = bytes.NewReader(jsonBytes)
			}
		}

		req := httptest.NewRequest(method, path, reqBody)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	t.Run("POST_Reserve_Positive_200", func(t *testing.T) {
		itemID := "http-res-pos-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 10)

		payload := domain.ReserveStockRequest{
			UserID:   "user-http-1",
			ItemID:   itemID,
			Quantity: 2,
		}

		w := doRequest(http.MethodPost, "/api/v1/inventory/reserve", payload)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp domain.ReserveStockResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.NotEmpty(t, resp.ReservationID)
		assert.Equal(t, itemID, resp.ItemID)
		assert.Equal(t, 2, resp.Quantity)
	})

	t.Run("POST_Reserve_Negative_400_Validation", func(t *testing.T) {
		invalidCases := []struct {
			name string
			body any
		}{
			{"empty_body", nil},
			{"malformed_json", "{invalid-json}"},
			{"missing_item_id", map[string]any{"user_id": "u1", "quantity": 1}},
			{"missing_user_id", map[string]any{"item_id": "i1", "quantity": 1}},
			{"zero_quantity", map[string]any{"user_id": "u1", "item_id": "i1", "quantity": 0}},
			{"negative_quantity", map[string]any{"user_id": "u1", "item_id": "i1", "quantity": -5}},
		}

		for _, tc := range invalidCases {
			t.Run(tc.name, func(t *testing.T) {
				w := doRequest(http.MethodPost, "/api/v1/inventory/reserve", tc.body)
				assert.Equal(t, http.StatusBadRequest, w.Code)

				var errResp domain.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, domain.ResponseStatusError, errResp.Status)
				assert.NotEmpty(t, errResp.Error)
			})
		}
	})

	t.Run("POST_Reserve_Negative_404_ItemNotFound", func(t *testing.T) {
		payload := domain.ReserveStockRequest{
			UserID:   "u1",
			ItemID:   "nonexistent-item-" + uuid.NewString(),
			Quantity: 1,
		}

		w := doRequest(http.MethodPost, "/api/v1/inventory/reserve", payload)
		assert.Equal(t, http.StatusNotFound, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Contains(t, errResp.Error, "item not found")
	})

	t.Run("POST_Reserve_Negative_409_InsufficientStock", func(t *testing.T) {
		itemID := "http-res-insufficient-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 2)

		payload := domain.ReserveStockRequest{
			UserID:   "u1",
			ItemID:   itemID,
			Quantity: 5,
		}

		w := doRequest(http.MethodPost, "/api/v1/inventory/reserve", payload)
		assert.Equal(t, http.StatusConflict, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Contains(t, errResp.Error, "insufficient stock")
	})

	t.Run("POST_Confirm_Positive_200", func(t *testing.T) {
		itemID := "http-conf-pos-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 10)

		res, err := svc.ReserveStock(context.Background(), domain.ReserveStockRequest{
			UserID:   "u-conf",
			ItemID:   itemID,
			Quantity: 3,
		})
		require.NoError(t, err)

		payload := domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		}

		w := doRequest(http.MethodPost, "/api/v1/inventory/confirm", payload)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp domain.ConfirmReservationResponse
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.Equal(t, res.ReservationID, resp.ReservationID)
		assert.False(t, resp.ConfirmedAt.IsZero())
	})

	t.Run("POST_Confirm_Negative_400_Validation", func(t *testing.T) {
		invalidCases := []struct {
			name string
			body any
		}{
			{"empty_body", nil},
			{"malformed_json", "{bad-json}"},
			{"empty_reservation_id", domain.ConfirmReservationRequest{ReservationID: ""}},
		}

		for _, tc := range invalidCases {
			t.Run(tc.name, func(t *testing.T) {
				w := doRequest(http.MethodPost, "/api/v1/inventory/confirm", tc.body)
				assert.Equal(t, http.StatusBadRequest, w.Code)

				var errResp domain.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, domain.ResponseStatusError, errResp.Status)
			})
		}
	})

	t.Run("POST_Confirm_Negative_400_AlreadyConfirmed", func(t *testing.T) {
		itemID := "http-conf-dup-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		res, err := svc.ReserveStock(context.Background(), domain.ReserveStockRequest{
			UserID:   "u1",
			ItemID:   itemID,
			Quantity: 1,
		})
		require.NoError(t, err)

		// First confirmation
		_, err = svc.ConfirmReservation(context.Background(), domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		require.NoError(t, err)

		// Duplicate confirmation via HTTP
		w := doRequest(http.MethodPost, "/api/v1/inventory/confirm", domain.ConfirmReservationRequest{
			ReservationID: res.ReservationID,
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var errResp domain.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "reservation is not in pending status")
	})

	t.Run("POST_Confirm_Negative_400_Expired", func(t *testing.T) {
		itemID := "http-conf-exp-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 5)

		expID := "http-exp-" + uuid.NewString()[:8]
		pastTime := time.Now().UTC().Add(-10 * time.Minute)
		_, err := db.Exec(`
			INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
			VALUES ($1, $2, $3, $4, 'EXPIRED', $5, $6)
		`, expID, "u1", itemID, 1, pastTime, pastTime)
		require.NoError(t, err)

		w := doRequest(http.MethodPost, "/api/v1/inventory/confirm", domain.ConfirmReservationRequest{
			ReservationID: expID,
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var errResp domain.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "reservation has expired")
	})

	t.Run("POST_Confirm_Negative_404_NotFound", func(t *testing.T) {
		w := doRequest(http.MethodPost, "/api/v1/inventory/confirm", domain.ConfirmReservationRequest{
			ReservationID: uuid.NewString(),
		})
		assert.Equal(t, http.StatusNotFound, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "reservation not found")
	})

	t.Run("GET_Stock_Positive_200", func(t *testing.T) {
		itemID := "http-stock-pos-" + uuid.NewString()[:8]
		setupTestItem(t, db, itemID, 25)

		w := doRequest(http.MethodGet, "/api/v1/inventory/stock?item_id="+itemID, nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp domain.InventoryStockResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.Equal(t, itemID, resp.ItemID)
		assert.Equal(t, 25, resp.TotalStock)
		assert.Equal(t, 0, resp.ReservedStock)
		assert.Equal(t, 25, resp.AvailableStock)
	})

	t.Run("GET_Stock_Negative_400_MissingItemID", func(t *testing.T) {
		w := doRequest(http.MethodGet, "/api/v1/inventory/stock", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "query parameter 'item_id' is required")
	})

	t.Run("GET_Stock_Negative_404_ItemNotFound", func(t *testing.T) {
		w := doRequest(http.MethodGet, "/api/v1/inventory/stock?item_id=nonexistent-"+uuid.NewString(), nil)
		assert.Equal(t, http.StatusNotFound, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "item not found")
	})

	t.Run("GET_Health_Positive_200", func(t *testing.T) {
		w := doRequest(http.MethodGet, "/health", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, "ok", resp["status"])
	})

	t.Run("NoRoute_Negative_404", func(t *testing.T) {
		w := doRequest(http.MethodGet, "/api/v1/inventory/unknown-endpoint", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)

		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Contains(t, errResp.Error, "route not found")
	})
}
