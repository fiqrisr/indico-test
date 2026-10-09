package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/fiqrisr/inventory-system/core/internal/domain"
	"github.com/fiqrisr/inventory-system/core/internal/service"
)

func TestInventoryService_InputValidation(t *testing.T) {
	svc := service.NewInventoryService(nil, 5*time.Minute)
	ctx := context.Background()

	t.Run("ReserveStock empty item_id", func(t *testing.T) {
		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "   ",
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})

	t.Run("ReserveStock empty user_id", func(t *testing.T) {
		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "",
			ItemID:   "item-1",
			Quantity: 1,
		})
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})

	t.Run("ReserveStock zero quantity", func(t *testing.T) {
		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "item-1",
			Quantity: 0,
		})
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})

	t.Run("ReserveStock negative quantity", func(t *testing.T) {
		_, err := svc.ReserveStock(ctx, domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "item-1",
			Quantity: -5,
		})
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})

	t.Run("ConfirmReservation empty reservation_id", func(t *testing.T) {
		_, err := svc.ConfirmReservation(ctx, domain.ConfirmReservationRequest{
			ReservationID: "  ",
		})
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})

	t.Run("GetStock empty item_id", func(t *testing.T) {
		_, err := svc.GetStock(ctx, "  ")
		assert.ErrorIs(t, err, domain.ErrInvalidInput)
	})
}
