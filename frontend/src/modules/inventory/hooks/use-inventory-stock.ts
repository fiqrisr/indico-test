import { useQuery } from '@tanstack/react-query'
import { fetchInventoryStock, inventoryKeys } from '../api/inventory-api'

interface UseInventoryStockOptions {
  pollingInterval?: number | false
  enabled?: boolean
}

export function useInventoryStock(
  itemId: string,
  options: UseInventoryStockOptions = {}
) {
  const { pollingInterval = 2500, enabled = true } = options

  return useQuery({
    queryKey: inventoryKeys.stock(itemId),
    queryFn: () => fetchInventoryStock(itemId),
    enabled: enabled && itemId.trim().length > 0,
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false,
  })
}
