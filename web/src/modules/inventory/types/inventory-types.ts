export interface InventoryStockResponse {
  item_id: string
  total_stock: number
  reserved_stock: number
  available_stock: number
}

export interface InventoryItemPreset {
  id: string
  name: string
  description: string
  badge?: string
  category?: string
  initialStock?: number
}

export const SEEDED_ITEM_PRESETS: InventoryItemPreset[] = [
  {
    id: 'flash-item-1',
    name: 'Flash Item 1 (Ultra Hub)',
    description: 'High-demand flash sale primary SKU with multi-region inventory allocation',
    badge: 'Popular',
    category: 'Hardware',
    initialStock: 5000,
  },
  {
    id: 'flash-item-2',
    name: 'Flash Item 2 (Edge Router)',
    description: 'Secondary high-speed networking SKU with enterprise-grade allocation',
    badge: 'Hot',
    category: 'Hardware',
    initialStock: 2500,
  },
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro Titanium',
    description: 'Flagship smartphone tier with titanium chassis and A17 Pro silicon',
    badge: 'Flagship',
    category: 'Phones',
    initialStock: 1200,
  },
  {
    id: 'limited-edition-sneakers',
    name: 'Limited Edition Sneakers',
    description: 'Exclusive designer streetwear runner drop with authenticated serials',
    badge: 'Exclusive',
    category: 'Lifestyle',
    initialStock: 800,
  },
  {
    id: 'playstation-5-pro',
    name: 'PlayStation 5 Pro',
    description: 'Next-gen high-frame-rate 4K console with upgraded ray tracing architecture',
    badge: 'Console',
    category: 'Gaming',
    initialStock: 3500,
  },
  {
    id: 'xbox-series-x-galaxy',
    name: 'Xbox Series X Special Edition',
    description: '2TB custom edition home entertainment and gaming console',
    badge: 'Console',
    category: 'Gaming',
    initialStock: 1800,
  },
  {
    id: 'nintendo-switch-oled',
    name: 'Nintendo Switch OLED',
    description: 'Handheld hybrid gaming system with vibrant 7-inch OLED display',
    badge: 'Trending',
    category: 'Gaming',
    initialStock: 4000,
  },
  {
    id: 'rtx-5090-oc',
    name: 'GeForce RTX 5090 OC',
    description: 'Ultra-enthusiast graphics card with 32GB GDDR7 memory for AI and gaming',
    badge: 'Enthusiast',
    category: 'Hardware',
    initialStock: 650,
  },
  {
    id: 'macbook-pro-m4',
    name: 'MacBook Pro 16" M4 Max',
    description: 'Pro workstation laptop with 16-core CPU, 40-core GPU, and 48GB unified memory',
    badge: 'Pro Laptop',
    category: 'Computing',
    initialStock: 1500,
  },
  {
    id: 'sony-wh1000xm5',
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Industry-leading wireless noise-canceling headphones with dual processors',
    badge: 'ANC Audio',
    category: 'Audio',
    initialStock: 3200,
  },
  {
    id: 'airpods-max-usb-c',
    name: 'AirPods Max (USB-C)',
    description: 'High-fidelity over-ear spatial audio headphones with active noise cancellation',
    badge: 'Hi-Fi Audio',
    category: 'Audio',
    initialStock: 2000,
  },
  {
    id: 'steam-deck-oled',
    name: 'Steam Deck OLED 1TB',
    description: 'Portable PC gaming powerhouse with 90Hz HDR OLED screen and fast NVMe',
    badge: 'Handheld',
    category: 'Gaming',
    initialStock: 2800,
  },
  {
    id: 'ipad-pro-m4',
    name: 'iPad Pro 13" Ultra Retina',
    description: 'Tandem OLED breakthrough display with ultra-thin enclosure and M4 processor',
    badge: 'Pro Tablet',
    category: 'Computing',
    initialStock: 1600,
  },
  {
    id: 'apple-watch-ultra-2',
    name: 'Apple Watch Ultra 2',
    description: 'Rugged 49mm titanium outdoor sports smartwatch with precision dual-frequency GPS',
    badge: 'Smartwatch',
    category: 'Wearables',
    initialStock: 2200,
  },
  {
    id: 'samsung-galaxy-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra',
    description: 'AI-accelerated flagship Android phone with built-in S Pen and quad telephoto zoom',
    badge: 'AI Phone',
    category: 'Phones',
    initialStock: 1400,
  },
  {
    id: 'meta-quest-3s',
    name: 'Meta Quest 3S VR Headset',
    description: 'Mixed-reality spatial computing and VR headset with color passthrough',
    badge: 'VR/AR',
    category: 'Gaming',
    initialStock: 4500,
  },
  {
    id: 'dji-mini-4-pro',
    name: 'DJI Mini 4 Pro Fly More',
    description: 'Ultralight 4K/60fps HDR camera drone with omnidirectional obstacle sensing',
    badge: '4K Drone',
    category: 'Hardware',
    initialStock: 1100,
  },
  {
    id: 'logitech-g-pro-superlight-2',
    name: 'Logitech G PRO X Superlight 2',
    description: '60g championship esports wireless gaming mouse with HERO 2 sensor',
    badge: 'Esports',
    category: 'Gaming',
    initialStock: 6000,
  },
  {
    id: 'keychron-q1-he',
    name: 'Keychron Q1 HE Hall Effect',
    description: 'Custom wireless magnetic switch mechanical keyboard with rapid trigger',
    badge: 'Magnetic KB',
    category: 'Computing',
    initialStock: 2400,
  },
  {
    id: 'lg-ultragear-32-oled',
    name: 'LG UltraGear 32" 4K OLED',
    description: 'Dual-mode 4K 240Hz / FHD 480Hz gaming monitor with 0.03ms GtG response',
    badge: 'OLED 240Hz',
    category: 'Gaming',
    initialStock: 950,
  },
]
