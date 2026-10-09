package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/fiqrisr/indico-test/core/internal/domain"
	"github.com/fiqrisr/indico-test/core/internal/repository"
)

type InventoryService interface {
	ReserveStock(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error)
	ConfirmReservation(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error)
	GetStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error)
}

type inventoryService struct {
	repo           repository.InventoryRepository
	expiryDuration time.Duration
}

func NewInventoryService(repo repository.InventoryRepository, expiryDuration time.Duration) InventoryService {
	if expiryDuration <= 0 {
		expiryDuration = 5 * time.Minute
	}
	return &inventoryService{
		repo:           repo,
		expiryDuration: expiryDuration,
	}
}

// ReserveStock reserves the specified quantity for an item using pessimistic locking.
func (s *inventoryService) ReserveStock(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error) {
	req.ItemID = strings.TrimSpace(req.ItemID)
	req.UserID = strings.TrimSpace(req.UserID)

	if req.ItemID == "" || req.UserID == "" || req.Quantity <= 0 {
		return nil, domain.ErrInvalidInput
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	// 1. Lock item row using SELECT ... FOR UPDATE
	inv, err := s.repo.GetInventoryForUpdate(ctx, tx, req.ItemID)
	if err != nil {
		return nil, err
	}

	// 2. Calculate currently active reserved stock
	reservedStock, err := s.repo.GetActiveReservedStock(ctx, tx, req.ItemID)
	if err != nil {
		return nil, err
	}

	// 3. Verify stock availability
	availableStock := inv.TotalStock - reservedStock
	if availableStock < req.Quantity {
		return nil, domain.ErrInsufficientStock
	}

	// 4. Create reservation record
	now := time.Now().UTC()
	expiresAt := now.Add(s.expiryDuration)
	reservationID := uuid.NewString()

	res := &domain.Reservation{
		ReservationID: reservationID,
		UserID:        req.UserID,
		ItemID:        req.ItemID,
		Quantity:      req.Quantity,
		Status:        domain.ReservationStatusPending,
		ExpiresAt:     expiresAt,
		CreatedAt:     now,
	}

	if err := s.repo.CreateReservation(ctx, tx, res); err != nil {
		return nil, err
	}

	// 5. Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &domain.ReserveStockResponse{
		ReservationID: reservationID,
		ItemID:        req.ItemID,
		Quantity:      req.Quantity,
		ExpiresAt:     expiresAt,
	}, nil
}

// ConfirmReservation marks a reservation as CONFIRMED and decrements total physical inventory stock.
func (s *inventoryService) ConfirmReservation(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error) {
	req.ReservationID = strings.TrimSpace(req.ReservationID)
	if req.ReservationID == "" {
		return nil, domain.ErrInvalidInput
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	// 1. Lock reservation row using SELECT ... FOR UPDATE
	res, err := s.repo.GetReservationForUpdate(ctx, tx, req.ReservationID)
	if err != nil {
		return nil, err
	}

	// 2. Validate reservation state
	if res.Status != domain.ReservationStatusPending {
		if res.Status == domain.ReservationStatusExpired {
			return nil, domain.ErrReservationExpired
		}
		return nil, domain.ErrReservationNotPending
	}

	// 3. Check expiration timestamp
	now := time.Now().UTC()
	if now.After(res.ExpiresAt) {
		// Update status to EXPIRED to persist the state
		_ = s.repo.UpdateReservationStatus(ctx, tx, res.ReservationID, domain.ReservationStatusExpired)
		_ = tx.Commit()
		return nil, domain.ErrReservationExpired
	}

	// 4. Update status to CONFIRMED
	if err := s.repo.UpdateReservationStatus(ctx, tx, res.ReservationID, domain.ReservationStatusConfirmed); err != nil {
		return nil, err
	}

	// 5. Decrement total physical stock
	if err := s.repo.DecrementInventoryStock(ctx, tx, res.ItemID, res.Quantity); err != nil {
		return nil, err
	}

	// 6. Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &domain.ConfirmReservationResponse{
		ReservationID: res.ReservationID,
		ConfirmedAt:   now,
	}, nil
}

// GetStock returns the current stock status of an item.
func (s *inventoryService) GetStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
	itemID = strings.TrimSpace(itemID)
	if itemID == "" {
		return nil, domain.ErrInvalidInput
	}

	return s.repo.GetInventoryStock(ctx, itemID)
}
