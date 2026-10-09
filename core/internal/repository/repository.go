package repository

import (
	"context"
	"database/sql"

	"github.com/fiqrisr/inventory-system/core/internal/domain"
)

// InventoryRepository abstracts database operations for inventory and reservations.
type InventoryRepository interface {
	BeginTx(ctx context.Context) (*sql.Tx, error)
	GetInventoryForUpdate(ctx context.Context, tx *sql.Tx, itemID string) (*domain.Inventory, error)
	GetActiveReservedStock(ctx context.Context, tx *sql.Tx, itemID string) (int, error)
	CreateReservation(ctx context.Context, tx *sql.Tx, res *domain.Reservation) error
	GetReservationForUpdate(ctx context.Context, tx *sql.Tx, reservationID string) (*domain.Reservation, error)
	UpdateReservationStatus(ctx context.Context, tx *sql.Tx, reservationID string, status domain.ReservationStatus) error
	DecrementInventoryStock(ctx context.Context, tx *sql.Tx, itemID string, quantity int) error
	GetInventoryStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error)
	ExpireOldPendingReservations(ctx context.Context) (int64, error)
}
