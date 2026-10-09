import { useState } from 'react'
import {
  Clock,
  Code2,
  History,
  ShieldCheck,
} from 'lucide-react'
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
        <Card className="border-border/80 bg-card/90 shadow-sm relative overflow-hidden backdrop-blur-xs">
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-amber-500/80" />

          <CardHeader className="pb-3.5 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Flash-Sale Checkout Hold
                </CardTitle>
                <CardDescription className="mt-1">
                  Acquire a temporary two-phase row lock before final payment confirmation
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className="self-start sm:self-auto text-xs font-mono py-0.5 px-2 bg-muted/50 border-primary/30 text-primary gap-1.5"
              >
                <Clock className="h-3 w-3" />
                5-Min Lease Hold
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-medium">
                <Code2 className="h-3.5 w-3.5 text-primary" />
                <span>Reactive field-level validation via <code className="font-mono text-foreground font-semibold">@tanstack/react-form</code></span>
              </div>
              <ReservationFormTanStack
                key={itemId}
                itemId={itemId}
                availableStock={availableStock}
                onSuccess={handleReservationSuccess}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mini Session History */}
      {holdHistory.length > 0 && (
        <Card className="border border-border/70 bg-card/60 shadow-2xs backdrop-blur-xs">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <History className="h-3.5 w-3.5 text-primary" />
                <span>Session Hold Audit Trail</span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {holdHistory.length} {holdHistory.length === 1 ? 'event' : 'events'} recorded
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
                    <span className="font-bold text-foreground truncate">{item.itemId}</span>
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
