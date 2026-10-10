package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SetupRouter initializes the Gin engine and configures middlewares and routes.
func SetupRouter(h *InventoryHandler, mode string) *gin.Engine {
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", h.HealthCheck)

	// API v1
	v1 := router.Group("/api/v1/inventory")
	{
		v1.POST("/reserve", h.ReserveStock)
		v1.POST("/confirm", h.ConfirmReservation)
		v1.GET("/stock", h.GetStock)
	}

	router.NoRoute(func(c *gin.Context) {
		sendError(c, http.StatusNotFound, "route not found")
	})

	return router
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
