import { useState } from 'react'
import { History, Layers, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ActiveReservationHold,
  ReserveStockResponse,
} from '../types/reservation-types'
import { ConfirmationCard } from './confirmation-card'
import { ReservationFormRHF } from './reservation-form-rhf'
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
        <Card className="shadow-md border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Flash-Sale Checkout Hold
                </CardTitle>
                <CardDescription className="mt-1">
                  Pessimistic row-level lock reservation pipeline
                </CardDescription>
              </div>

              <Badge variant="outline" className="text-xs">
                5-Min Hold Window
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {/* Form Selection Tabs: TanStack Form vs React Hook Form */}
            <Tabs defaultValue="tanstack" className="w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Form Architecture Engine:
                </span>
                <TabsList className="grid grid-cols-2 h-8">
                  <TabsTrigger value="tanstack" className="text-xs px-2.5">
                    TanStack Form
                  </TabsTrigger>
                  <TabsTrigger value="rhf" className="text-xs px-2.5">
                    React Hook Form
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="tanstack" className="mt-0">
                <div className="rounded-lg border bg-muted/20 p-4 mb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Reactive field-level validation via <code>@tanstack/react-form</code></span>
                  </div>
                  <ReservationFormTanStack
                    itemId={itemId}
                    availableStock={availableStock}
                    onSuccess={handleReservationSuccess}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rhf" className="mt-0">
                <div className="rounded-lg border bg-muted/20 p-4 mb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Schema-driven validation via <code>react-hook-form</code> + <code>zod</code></span>
                  </div>
                  <ReservationFormRHF
                    itemId={itemId}
                    availableStock={availableStock}
                    onSuccess={handleReservationSuccess}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Mini Session History */}
      {holdHistory.length > 0 && (
        <Card className="border border-border/60 bg-card/60">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                <span>Session Holds Log ({holdHistory.length})</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="divide-y divide-border/60 text-xs">
              {holdHistory.map((item) => (
                <div
                  key={item.reservationId}
                  className="py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-mono truncate">
                    <span className="text-muted-foreground">
                      {item.reservationId.slice(0, 8)}
                    </span>
                    <span className="font-semibold">{item.itemId}</span>
                    <span className="text-muted-foreground">
                      ({item.quantity} units)
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
                    className="text-[10px] py-0 px-1.5"
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
