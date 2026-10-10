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
    ('flash-item-1', 5000),
    ('flash-item-2', 2500),
    ('iphone-15-pro', 1200),
    ('limited-edition-sneakers', 800),
    ('playstation-5-pro', 3500),
    ('xbox-series-x-galaxy', 1800),
    ('nintendo-switch-oled', 4000),
    ('rtx-5090-oc', 650),
    ('macbook-pro-m4', 1500),
    ('sony-wh1000xm5', 3200),
    ('airpods-max-usb-c', 2000),
    ('steam-deck-oled', 2800),
    ('ipad-pro-m4', 1600),
    ('apple-watch-ultra-2', 2200),
    ('samsung-galaxy-s24-ultra', 1400),
    ('meta-quest-3s', 4500),
    ('dji-mini-4-pro', 1100),
    ('logitech-g-pro-superlight-2', 6000),
    ('keychron-q1-he', 2400),
    ('lg-ultragear-32-oled', 950)
ON CONFLICT (item_id) DO UPDATE 
SET total_stock = EXCLUDED.total_stock;
