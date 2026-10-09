import { useState } from 'react'
import { Clock, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  ActiveReservationHold,
  ReserveStockResponse,
} from '../types/reservation-types'
import { ConfirmationCard } from './confirmation-card'
import { ReservationFormTanStack } from './reservation-form-tanstack'

interface ReservationPanelProps {
  itemId: string
  availableStock: number
}

export function ReservationPanel({
  itemId,
  availableStock,
}: ReservationPanelProps) {
  const [activeHold, setActiveHold] = useState<ActiveReservationHold | null>(
    null
  )
  const [holdHistory, setHoldHistory] = useState<ActiveReservationHold[]>([])

  const handleReservationSuccess = (
    data: ReserveStockResponse,
    userId: string
  ) => {
    const newHold: ActiveReservationHold = {
      reservationId: data.reservation_id,
      itemId: data.item_id,
      userId,
      quantity: data.quantity,
      expiresAt: data.expires_at,
      status: 'PENDING',
    }
    setActiveHold(newHold)
    setHoldHistory((prev) => [newHold, ...prev.slice(0, 4)])
  }

  const handleConfirmSuccess = (confirmedAt: string) => {
    if (!activeHold) return
    const updated: ActiveReservationHold = {
      ...activeHold,
      status: 'CONFIRMED',
      confirmedAt,
    }
    setActiveHold(updated)
    setHoldHistory((prev) =>
      prev.map((h) =>
        h.reservationId === activeHold.reservationId ? updated : h
      )
    )
  }

  const handleHoldExpired = () => {
    if (!activeHold) return
    const updated: ActiveReservationHold = {
      ...activeHold,
      status: 'EXPIRED',
    }
    setActiveHold(updated)
    setHoldHistory((prev) =>
      prev.map((h) =>
        h.reservationId === activeHold.reservationId ? updated : h
      )
    )
  }

  const handleReset = () => {
    setActiveHold(null)
  }

  return (
    <div className="space-y-4">
      {activeHold ? (
        <ConfirmationCard
          hold={activeHold}
          onConfirmSuccess={handleConfirmSuccess}
          onHoldExpired={handleHoldExpired}
          onReset={handleReset}
        />
      ) : (
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">
                  Reserve Stock
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Hold items for 5 minutes while you complete checkout
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className="self-start sm:self-auto text-xs font-mono py-0.5 px-2 bg-muted/60 text-foreground font-medium gap-1.5 whitespace-nowrap shrink-0"
              >
                <Clock className="h-3 w-3 text-primary" />
                5-Min Hold Window
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <ReservationFormTanStack
              key={itemId}
              itemId={itemId}
              availableStock={availableStock}
              onSuccess={handleReservationSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* Recent Reservations Activity */}
      {holdHistory.length > 0 && (
        <Card className="border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Recent Reservations</span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {holdHistory.length} {holdHistory.length === 1 ? 'record' : 'records'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="divide-y divide-border/60 text-xs">
              {holdHistory.map((item) => (
                <div
                  key={item.reservationId}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 font-mono truncate min-w-0">
                    <span className="text-muted-foreground/70 shrink-0">
                      {item.reservationId.slice(0, 8)}
                    </span>
                    <span className="font-semibold text-foreground truncate">{item.itemId}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      ({item.quantity} {item.quantity === 1 ? 'unit' : 'units'})
                    </span>
                  </div>
                  <Badge
                    variant={
                      item.status === 'CONFIRMED'
                        ? 'success'
                        : item.status === 'EXPIRED'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px] font-mono py-0 px-1.5 uppercase tracking-wider shrink-0"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
