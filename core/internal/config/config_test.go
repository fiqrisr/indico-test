package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/fiqrisr/inventory-system/core/internal/config"
)

func TestLoad_Defaults(t *testing.T) {
	os.Clearenv()

	cfg := config.Load()

	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "postgres://postgres:postgres@localhost:5433/inventory_db?sslmode=disable", cfg.DatabaseURL)
	assert.Equal(t, "release", cfg.GinMode)
	assert.Equal(t, 30*time.Second, cfg.ExpiryInterval)
	assert.Equal(t, 5*time.Minute, cfg.ReservationExpiryDuration)
}

func TestLoad_CustomEnv(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("DATABASE_URL", "postgres://custom:custom@localhost:5432/custom_db")
	os.Setenv("GIN_MODE", "debug")
	os.Setenv("EXPIRY_INTERVAL", "1m")
	os.Setenv("RESERVATION_EXPIRY_MINUTES", "10")
	defer os.Clearenv()

	cfg := config.Load()

	assert.Equal(t, "9090", cfg.Port)
	assert.Equal(t, "postgres://custom:custom@localhost:5432/custom_db", cfg.DatabaseURL)
	assert.Equal(t, "debug", cfg.GinMode)
	assert.Equal(t, 1*time.Minute, cfg.ExpiryInterval)
	assert.Equal(t, 10*time.Minute, cfg.ReservationExpiryDuration)
}
