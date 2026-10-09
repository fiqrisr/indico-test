package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/fiqrisr/inventory-system/core/internal/domain"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// BeginTx starts a database transaction.
func (r *PostgresRepository) BeginTx(ctx context.Context) (*sql.Tx, error) {
	return r.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	})
}

// GetInventoryForUpdate locks the inventory row for an item using SELECT ... FOR UPDATE.
func (r *PostgresRepository) GetInventoryForUpdate(ctx context.Context, tx *sql.Tx, itemID string) (*domain.Inventory, error) {
	query := `
		SELECT item_id, total_stock, created_at, updated_at 
		FROM inventory 
		WHERE item_id = $1 
		FOR UPDATE
	`
	var inv domain.Inventory
	err := tx.QueryRowContext(ctx, query, itemID).Scan(
		&inv.ItemID,
		&inv.TotalStock,
		&inv.CreatedAt,
		&inv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrItemNotFound
		}
		return nil, fmt.Errorf("failed to lock inventory row: %w", err)
	}
	return &inv, nil
}

// GetActiveReservedStock calculates the sum of active PENDING reservations for an item.
func (r *PostgresRepository) GetActiveReservedStock(ctx context.Context, tx *sql.Tx, itemID string) (int, error) {
	query := `
		SELECT COALESCE(SUM(quantity), 0)
		FROM reservations
		WHERE item_id = $1 
		  AND status = 'PENDING' 
		  AND expires_at > NOW()
	`
	var reserved int
	err := tx.QueryRowContext(ctx, query, itemID).Scan(&reserved)
	if err != nil {
		return 0, fmt.Errorf("failed to query active reserved stock: %w", err)
	}
	return reserved, nil
}

// CreateReservation inserts a new reservation record within the current transaction.
func (r *PostgresRepository) CreateReservation(ctx context.Context, tx *sql.Tx, res *domain.Reservation) error {
	query := `
		INSERT INTO reservations (reservation_id, user_id, item_id, quantity, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := tx.ExecContext(ctx, query,
		res.ReservationID,
		res.UserID,
		res.ItemID,
		res.Quantity,
		res.Status,
		res.ExpiresAt,
		res.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert reservation: %w", err)
	}
	return nil
}

// GetReservationForUpdate locks the reservation row using SELECT ... FOR UPDATE.
func (r *PostgresRepository) GetReservationForUpdate(ctx context.Context, tx *sql.Tx, reservationID string) (*domain.Reservation, error) {
	query := `
		SELECT reservation_id, user_id, item_id, quantity, status, expires_at, created_at
		FROM reservations
		WHERE reservation_id = $1
		FOR UPDATE
	`
	var res domain.Reservation
	err := tx.QueryRowContext(ctx, query, reservationID).Scan(
		&res.ReservationID,
		&res.UserID,
		&res.ItemID,
		&res.Quantity,
		&res.Status,
		&res.ExpiresAt,
		&res.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrReservationNotFound
		}
		return nil, fmt.Errorf("failed to lock reservation row: %w", err)
	}
	return &res, nil
}

// UpdateReservationStatus updates the status of a reservation within a transaction.
func (r *PostgresRepository) UpdateReservationStatus(ctx context.Context, tx *sql.Tx, reservationID string, status domain.ReservationStatus) error {
	query := `
		UPDATE reservations
		SET status = $1
		WHERE reservation_id = $2
	`
	res, err := tx.ExecContext(ctx, query, status, reservationID)
	if err != nil {
		return fmt.Errorf("failed to update reservation status: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return domain.ErrReservationNotFound
	}
	return nil
}

// DecrementInventoryStock reduces total physical stock for an item within a transaction.
func (r *PostgresRepository) DecrementInventoryStock(ctx context.Context, tx *sql.Tx, itemID string, quantity int) error {
	query := `
		UPDATE inventory
		SET total_stock = total_stock - $1, updated_at = NOW()
		WHERE item_id = $2
	`
	res, err := tx.ExecContext(ctx, query, quantity, itemID)
	if err != nil {
		return fmt.Errorf("failed to decrement inventory stock: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return domain.ErrItemNotFound
	}
	return nil
}

// GetInventoryStock returns physical, reserved, and available stock for an item.
func (r *PostgresRepository) GetInventoryStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
	query := `
		SELECT 
			i.item_id, 
			i.total_stock, 
			COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'PENDING' AND r.expires_at > NOW()), 0) AS reserved_stock
		FROM inventory i
		LEFT JOIN reservations r ON i.item_id = r.item_id
		WHERE i.item_id = $1
		GROUP BY i.item_id, i.total_stock
	`
	var resp domain.InventoryStockResponse
	err := r.db.QueryRowContext(ctx, query, itemID).Scan(
		&resp.ItemID,
		&resp.TotalStock,
		&resp.ReservedStock,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrItemNotFound
		}
		return nil, fmt.Errorf("failed to query inventory stock: %w", err)
	}

	resp.AvailableStock = resp.TotalStock - resp.ReservedStock
	if resp.AvailableStock < 0 {
		resp.AvailableStock = 0
	}
	return &resp, nil
}

// ExpireOldPendingReservations transitions past-due PENDING reservations to EXPIRED.
func (r *PostgresRepository) ExpireOldPendingReservations(ctx context.Context) (int64, error) {
	query := `
		UPDATE reservations
		SET status = 'EXPIRED'
		WHERE status = 'PENDING' 
		  AND expires_at <= NOW()
	`
	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to expire pending reservations: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}
	return rows, nil
}
