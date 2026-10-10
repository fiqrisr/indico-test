package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fiqrisr/indico-test/core/internal/domain"
	"github.com/fiqrisr/indico-test/core/internal/handler"
)

// mockInventoryService implements service.InventoryService for testing
type mockInventoryService struct {
	reserveFunc func(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error)
	confirmFunc func(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error)
	stockFunc   func(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error)
}

func (m *mockInventoryService) ReserveStock(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error) {
	if m.reserveFunc != nil {
		return m.reserveFunc(ctx, req)
	}
	return nil, nil
}

func (m *mockInventoryService) ConfirmReservation(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error) {
	if m.confirmFunc != nil {
		return m.confirmFunc(ctx, req)
	}
	return nil, nil
}

func (m *mockInventoryService) GetStock(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
	if m.stockFunc != nil {
		return m.stockFunc(ctx, itemID)
	}
	return nil, nil
}

func setupTestRouter(svc *mockInventoryService) http.Handler {
	h := handler.NewInventoryHandler(svc)
	return handler.SetupRouter(h, "release")
}

func TestReserveStock_Handler(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			reserveFunc: func(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error) {
				return &domain.ReserveStockResponse{
					ReservationID: "res-123",
					ItemID:        req.ItemID,
					Quantity:      req.Quantity,
					ExpiresAt:     time.Now().Add(5 * time.Minute),
				}, nil
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "item-1",
			Quantity: 2,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/reserve", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp domain.ReserveStockResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.Equal(t, "res-123", resp.ReservationID)
		assert.Equal(t, "item-1", resp.ItemID)
		assert.Equal(t, 2, resp.Quantity)
	})
	t.Run("insufficient stock returns 409", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			reserveFunc: func(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error) {
				return nil, domain.ErrInsufficientStock
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "item-1",
			Quantity: 999,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/reserve", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusConflict, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Contains(t, errResp.Error, "insufficient stock")
	})
	t.Run("item not found returns 404", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			reserveFunc: func(ctx context.Context, req domain.ReserveStockRequest) (*domain.ReserveStockResponse, error) {
				return nil, domain.ErrItemNotFound
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ReserveStockRequest{
			UserID:   "user-1",
			ItemID:   "unknown-item",
			Quantity: 1,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/reserve", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusNotFound, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Equal(t, "item not found", errResp.Error)
	})
	t.Run("invalid input returns 400", func(t *testing.T) {
		mockSvc := &mockInventoryService{}
		router := setupTestRouter(mockSvc)

		body := []byte(`{"user_id": "", "item_id": "item-1", "quantity": 0}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/reserve", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Contains(t, errResp.Error, "invalid request body")
	})
}

func TestConfirmReservation_Handler(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		now := time.Now().UTC()
		mockSvc := &mockInventoryService{
			confirmFunc: func(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error) {
				return &domain.ConfirmReservationResponse{
					ReservationID: req.ReservationID,
					ConfirmedAt:   now,
				}, nil
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ConfirmReservationRequest{
			ReservationID: "res-123",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/confirm", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp domain.ConfirmReservationResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.Equal(t, "res-123", resp.ReservationID)
	})
	t.Run("reservation expired returns 400", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			confirmFunc: func(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error) {
				return nil, domain.ErrReservationExpired
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ConfirmReservationRequest{
			ReservationID: "expired-res",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/confirm", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Equal(t, "reservation has expired", errResp.Error)
	})
	t.Run("reservation not found returns 404", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			confirmFunc: func(ctx context.Context, req domain.ConfirmReservationRequest) (*domain.ConfirmReservationResponse, error) {
				return nil, domain.ErrReservationNotFound
			},
		}

		router := setupTestRouter(mockSvc)
		body, _ := json.Marshal(domain.ConfirmReservationRequest{
			ReservationID: "missing-res",
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/confirm", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Equal(t, "reservation not found", errResp.Error)
	})
}

func TestGetStock_Handler(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			stockFunc: func(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
				return &domain.InventoryStockResponse{
					ItemID:         itemID,
					TotalStock:     100,
					ReservedStock:  20,
					AvailableStock: 80,
				}, nil
			},
		}

		router := setupTestRouter(mockSvc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stock?item_id=item-1", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp domain.InventoryStockResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusSuccess, resp.Status)
		assert.Equal(t, "item-1", resp.ItemID)
		assert.Equal(t, 100, resp.TotalStock)
		assert.Equal(t, 20, resp.ReservedStock)
		assert.Equal(t, 80, resp.AvailableStock)
	})
	t.Run("missing item_id returns 400", func(t *testing.T) {
		mockSvc := &mockInventoryService{}
		router := setupTestRouter(mockSvc)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stock", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Equal(t, "query parameter 'item_id' is required", errResp.Error)
	})
	t.Run("item not found returns 404", func(t *testing.T) {
		mockSvc := &mockInventoryService{
			stockFunc: func(ctx context.Context, itemID string) (*domain.InventoryStockResponse, error) {
				return nil, domain.ErrItemNotFound
			},
		}

		router := setupTestRouter(mockSvc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stock?item_id=unknown", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusNotFound, w.Code)
		var errResp domain.ErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &errResp)
		require.NoError(t, err)
		assert.Equal(t, domain.ResponseStatusError, errResp.Status)
		assert.Equal(t, "item not found", errResp.Error)
	})
}

func TestHealthCheck_Handler(t *testing.T) {
	mockSvc := &mockInventoryService{}
	router := setupTestRouter(mockSvc)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"status":"ok"}`, w.Body.String())
}

func TestCorsMiddleware(t *testing.T) {
	mockSvc := &mockInventoryService{}
	router := setupTestRouter(mockSvc)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/inventory/reserve", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestNoRoute_Handler(t *testing.T) {
	mockSvc := &mockInventoryService{}
	router := setupTestRouter(mockSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/unknown-endpoint", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	var errResp domain.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	require.NoError(t, err)
	assert.Equal(t, domain.ResponseStatusError, errResp.Status)
	assert.Equal(t, "route not found", errResp.Error)
}
