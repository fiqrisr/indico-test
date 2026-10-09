package domain

import (
	"errors"
	"time"
)

// ReservationStatus represents the lifecycle state of an inventory reservation.
type ReservationStatus string

const (
	ReservationStatusPending   ReservationStatus = "PENDING"
	ReservationStatusConfirmed ReservationStatus = "CONFIRMED"
	ReservationStatusExpired   ReservationStatus = "EXPIRED"
)

// Inventory represents the physical inventory stock of an item.
type Inventory struct {
	ItemID     string    `json:"item_id"`
	TotalStock int       `json:"total_stock"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Reservation represents a temporary hold on inventory for a user.
type Reservation struct {
	ReservationID string            `json:"reservation_id"`
	UserID        string            `json:"user_id"`
	ItemID        string            `json:"item_id"`
	Quantity      int               `json:"quantity"`
	Status        ReservationStatus `json:"status"`
	ExpiresAt     time.Time         `json:"expires_at"`
	CreatedAt     time.Time         `json:"created_at"`
}

// ReserveStockRequest is the payload for POST /api/v1/inventory/reserve.
type ReserveStockRequest struct {
	UserID   string `json:"user_id" binding:"required"`
	ItemID   string `json:"item_id" binding:"required"`
	Quantity int    `json:"quantity" binding:"required,gt=0"`
}

// ReserveStockResponse is the payload returned upon successful reservation.
type ReserveStockResponse struct {
	ReservationID string    `json:"reservation_id"`
	ItemID        string    `json:"item_id"`
	Quantity      int       `json:"quantity"`
	ExpiresAt     time.Time `json:"expires_at"`
}

// ConfirmReservationRequest is the payload for POST /api/v1/inventory/confirm.
type ConfirmReservationRequest struct {
	ReservationID string `json:"reservation_id" binding:"required"`
}

// ConfirmReservationResponse is the payload returned upon successful confirmation.
type ConfirmReservationResponse struct {
	ReservationID string    `json:"reservation_id"`
	ConfirmedAt   time.Time `json:"confirmed_at"`
}

// InventoryStockResponse is the payload for GET /api/v1/inventory/stock.
type InventoryStockResponse struct {
	ItemID         string `json:"item_id"`
	TotalStock     int    `json:"total_stock"`
	ReservedStock  int    `json:"reserved_stock"`
	AvailableStock int    `json:"available_stock"`
}

// Domain Errors
var (
	ErrItemNotFound          = errors.New("item not found")
	ErrInsufficientStock     = errors.New("insufficient stock")
	ErrReservationNotFound   = errors.New("reservation not found")
	ErrReservationNotPending = errors.New("reservation is not in pending status")
	ErrReservationExpired    = errors.New("reservation has expired")
	ErrInvalidInput          = errors.New("invalid input")
)
