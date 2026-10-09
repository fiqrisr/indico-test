import { request } from '@/lib/api-client'
import type {
  ConfirmReservationRequest,
  ConfirmReservationResponse,
  ReserveStockRequest,
  ReserveStockResponse,
} from '../types/reservation-types'

export async function reserveStock(
  payload: ReserveStockRequest
): Promise<ReserveStockResponse> {
  return request<ReserveStockResponse>('/api/v1/inventory/reserve', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function confirmReservation(
  payload: ConfirmReservationRequest
): Promise<ConfirmReservationResponse> {
  return request<ConfirmReservationResponse>('/api/v1/inventory/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
