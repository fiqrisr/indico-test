import { request } from '@/lib/api-client'
import type { InventoryStockResponse } from '../types/inventory-types'

export const inventoryKeys = {
  all: ['inventory'] as const,
  stock: (itemId: string) => ['inventory', 'stock', itemId] as const,
}

export async function fetchInventoryStock(
  itemId: string
): Promise<InventoryStockResponse> {
  const params = new URLSearchParams({ item_id: itemId })
  return request<InventoryStockResponse>(`/api/v1/inventory/stock?${params.toString()}`)
}
