export interface ReserveStockRequest {
  user_id: string
  item_id: string
  quantity: number
}

export interface ReserveStockResponse {
  reservation_id: string
  item_id: string
  quantity: number
  expires_at: string
}

export interface ConfirmReservationRequest {
  reservation_id: string
}

export interface ConfirmReservationResponse {
  reservation_id: string
  confirmed_at: string
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED'

export interface ActiveReservationHold {
  reservationId: string
  itemId: string
  userId: string
  quantity: number
  expiresAt: string
  status: ReservationStatus
  confirmedAt?: string
}
