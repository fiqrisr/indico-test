package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
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
	loadDotEnv(".env", "core/.env")

	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/indico_test_db?sslmode=disable")
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

func loadDotEnv(paths ...string) {
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"'`)
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
		}
		break
	}
}
