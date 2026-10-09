import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryKeys } from '@/modules/inventory/api/inventory-api'
import { reserveStock } from '../api/reservation-api'
import type { ReserveStockRequest, ReserveStockResponse } from '../types/reservation-types'

export function useReserveStock() {
  const queryClient = useQueryClient()

  return useMutation<ReserveStockResponse, Error, ReserveStockRequest>({
    mutationFn: (variables) => reserveStock(variables),
    onSuccess: (data) => {
      // Invalidate stock query so reserved & available counters immediately refresh
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.stock(data.item_id),
      })
    },
  })
}
