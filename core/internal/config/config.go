package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                       string
	DatabaseURL                string
	GinMode                    string
	ExpiryInterval             time.Duration
	ReservationExpiryDuration time.Duration
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/inventory_db?sslmode=disable")
	ginMode := getEnv("GIN_MODE", "release")

	expiryIntervalStr := getEnv("EXPIRY_INTERVAL", "30s")
	expiryInterval, err := time.ParseDuration(expiryIntervalStr)
	if err != nil {
		expiryInterval = 30 * time.Second
	}

	expiryMinsStr := getEnv("RESERVATION_EXPIRY_MINUTES", "5")
	expiryMins, err := strconv.Atoi(expiryMinsStr)
	if err != nil || expiryMins <= 0 {
		expiryMins = 5
	}

	return &Config {
		Port:                       port,
		DatabaseURL:                dbURL,
		GinMode:                    ginMode,
		ExpiryInterval:             expiryInterval,
		ReservationExpiryDuration: time.Duration(expiryMins) * time.Minute,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
