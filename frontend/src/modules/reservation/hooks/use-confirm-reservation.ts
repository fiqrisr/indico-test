import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryKeys } from '@/modules/inventory/api/inventory-api'
import { confirmReservation } from '../api/reservation-api'
import type {
  ConfirmReservationRequest,
  ConfirmReservationResponse,
} from '../types/reservation-types'

interface ConfirmReservationVariables extends ConfirmReservationRequest {
  itemId?: string
}

export function useConfirmReservation() {
  const queryClient = useQueryClient()

  return useMutation<
    ConfirmReservationResponse,
    Error,
    ConfirmReservationVariables
  >({
    mutationFn: ({ reservation_id }) =>
      confirmReservation({ reservation_id }),
    onSuccess: (_, variables) => {
      if (variables.itemId) {
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.stock(variables.itemId),
        })
      } else {
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.all,
        })
      }
    },
  })
}
