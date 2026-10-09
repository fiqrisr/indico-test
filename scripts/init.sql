-- Initialize PostgreSQL Schema for indico-test Core Service

CREATE TABLE IF NOT EXISTS inventory (
    item_id VARCHAR(255) PRIMARY KEY,
    total_stock INT NOT NULL CHECK (total_stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(255) NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of active pending reservations per item
CREATE INDEX IF NOT EXISTS idx_reservations_item_pending_active 
ON reservations(item_id, status, expires_at);

-- Index for background ticker auto-expiry sweeps
CREATE INDEX IF NOT EXISTS idx_reservations_expiry_sweep 
ON reservations(status, expires_at);

-- Seed initial items for flash sale testing and demonstration
INSERT INTO inventory (item_id, total_stock)
VALUES 
    ('flash-item-1', 100),
    ('flash-item-2', 50),
    ('iphone-15-pro', 20),
    ('limited-edition-sneakers', 10)
ON CONFLICT (item_id) DO UPDATE 
SET total_stock = EXCLUDED.total_stock;
