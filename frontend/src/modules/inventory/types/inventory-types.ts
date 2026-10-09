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
}

export const SEEDED_ITEM_PRESETS: InventoryItemPreset[] = [
  {
    id: 'flash-item-1',
    name: 'Flash Item 1',
    description: 'High-demand flash sale primary SKU',
    badge: 'Popular',
  },
  {
    id: 'flash-item-2',
    name: 'Flash Item 2',
    description: 'Secondary flash sale SKU with limited inventory',
  },
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    description: 'Flagship smartphone stock tier',
    badge: 'Flagship',
  },
  {
    id: 'limited-edition-sneakers',
    name: 'Limited Edition Sneakers',
    description: 'Ultra-exclusive drop with low total allocation',
    badge: 'Exclusive',
  },
]
