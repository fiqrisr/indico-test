package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fiqrisr/indico-test/core/internal/domain"
	"github.com/fiqrisr/indico-test/core/internal/service"
)

type InventoryHandler struct {
	service service.InventoryService
}

func NewInventoryHandler(service service.InventoryService) *InventoryHandler {
	return &InventoryHandler{service: service}
}

// ReserveStock handles POST /api/v1/inventory/reserve.
func (h *InventoryHandler) ReserveStock(c *gin.Context) {
	var req domain.ReserveStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.ReserveStock(c.Request.Context(), req)
	if err != nil {
		handleError(c, err)
		return
	}

	res.Status = domain.ResponseStatusSuccess
	sendSuccess(c, http.StatusOK, res)
}

// ConfirmReservation handles POST /api/v1/inventory/confirm.
func (h *InventoryHandler) ConfirmReservation(c *gin.Context) {
	var req domain.ConfirmReservationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.ConfirmReservation(c.Request.Context(), req)
	if err != nil {
		handleError(c, err)
		return
	}

	res.Status = domain.ResponseStatusSuccess
	sendSuccess(c, http.StatusOK, res)
}

// GetStock handles GET /api/v1/inventory/stock?item_id={item_id}.
func (h *InventoryHandler) GetStock(c *gin.Context) {
	itemID := c.Query("item_id")
	if itemID == "" {
		sendError(c, http.StatusBadRequest, "query parameter 'item_id' is required")
		return
	}

	res, err := h.service.GetStock(c.Request.Context(), itemID)
	if err != nil {
		handleError(c, err)
		return
	}

	res.Status = domain.ResponseStatusSuccess
	sendSuccess(c, http.StatusOK, res)
}

// HealthCheck handles GET /health.
func (h *InventoryHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func handleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidInput):
		sendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrItemNotFound):
		sendError(c, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrReservationNotFound):
		sendError(c, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrInsufficientStock):
		// Per specification: Insufficient stock (409/400)
		sendError(c, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrReservationExpired):
		sendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrReservationNotPending):
		sendError(c, http.StatusBadRequest, err.Error())
	default:
		sendError(c, http.StatusInternalServerError, "internal server error: "+err.Error())
	}
}

func sendSuccess(c *gin.Context, statusCode int, data any) {
	c.JSON(statusCode, data)
}

func sendError(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, domain.ErrorResponse{
		Status: domain.ResponseStatusError,
		Error:  message,
	})
}
