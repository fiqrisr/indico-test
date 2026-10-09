import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  Loader2,
  Package,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useConfirmReservation } from '../hooks/use-confirm-reservation'
import type { ActiveReservationHold } from '../types/reservation-types'
import { CountdownTimer } from './countdown-timer'

interface ConfirmationCardProps {
  hold: ActiveReservationHold
  onConfirmSuccess: (confirmedAt: string) => void
  onHoldExpired: () => void
  onReset: () => void
}

export function ConfirmationCard({
  hold,
  onConfirmSuccess,
  onHoldExpired,
  onReset,
}: ConfirmationCardProps) {
  const [isLocallyExpired, setIsLocallyExpired] = useState(
    hold.status === 'EXPIRED'
  )
  const confirmMutation = useConfirmReservation()

  const handleExpire = () => {
    setIsLocallyExpired(true)
    onHoldExpired()
  }

  const handleConfirmPurchase = async () => {
    if (isExpired) {
      toast.error('Hold Expired', {
        description: 'This reservation has elapsed and stock was released.',
      })
      return
    }

    try {
      const result = await confirmMutation.mutateAsync({
        reservation_id: hold.reservationId,
      })
      toast.success('Inventory Purchase Confirmed', {
        description: `Hold ${hold.reservationId.slice(0, 8)} finalized in database.`,
      })
      onConfirmSuccess(result.confirmed_at)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Could not confirm reservation'
      toast.error('Confirmation Failed', {
        description: msg,
      })
    }
  }

  const isConfirmed = hold.status === 'CONFIRMED'
  const isExpired = isLocallyExpired || hold.status === 'EXPIRED'

  return (
    <Card
      className={`relative overflow-hidden border shadow-sm transition-all duration-300 ${
        isConfirmed
          ? 'border-emerald-500/40 bg-emerald-500/3 dark:bg-emerald-500/5'
          : isExpired
          ? 'border-destructive/40 bg-destructive/3 dark:bg-destructive/5'
          : 'border-primary/40 bg-card/90 ring-1 ring-primary/20'
      }`}
    >
      {/* Top Status Gradient Bar */}
      <div
        className={`h-1.5 w-full ${
          isConfirmed
            ? 'bg-emerald-500'
            : isExpired
            ? 'bg-destructive'
            : 'bg-gradient-to-r from-primary via-primary/80 to-amber-500'
        }`}
      />

      <CardHeader className="pb-3.5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isConfirmed
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : isExpired
                  ? 'border-destructive/30 bg-destructive/15 text-destructive'
                  : 'border-primary/30 bg-primary/15 text-primary'
              }`}
            >
              {isConfirmed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isExpired ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </span>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                {isConfirmed
                  ? 'Stock Purchase Finalized'
                  : isExpired
                  ? 'Hold Lease Elapsed'
                  : 'Active Stock Hold'}
              </CardTitle>
              <CardDescription className="text-xs">
                Two-Phase Stock Hold Pipeline &bull; Phase 2 Finalization
              </CardDescription>
            </div>
          </div>

          <Badge
            variant={
              isConfirmed ? 'success' : isExpired ? 'destructive' : 'default'
            }
            className="text-xs font-mono px-2.5 py-0.5 uppercase tracking-wider"
          >
            {isConfirmed ? 'CONFIRMED' : isExpired ? 'EXPIRED' : 'HOLD ACTIVE'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reservation Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-muted/30 p-3.5 rounded-xl border border-border/70 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-wider">
              Target SKU
            </span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-foreground truncate">
              <Package className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{hold.itemId}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-wider">
              Units Reserved
            </span>
            <div className="font-mono font-bold text-foreground tabular-nums text-sm">
              {hold.quantity} {hold.quantity === 1 ? 'unit' : 'units'}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-wider">
              Shopper ID
            </span>
            <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground truncate">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{hold.userId}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-wider">
              Hold Token
            </span>
            <div
              className="flex items-center gap-1 font-mono text-muted-foreground truncate"
              title={hold.reservationId}
            >
              <Fingerprint className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{hold.reservationId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Live Countdown Timer (while active) */}
        {!isConfirmed && (
          <CountdownTimer
            expiresAt={hold.expiresAt}
            onExpire={handleExpire}
          />
        )}

        {/* Confirmed Success Banner */}
        {isConfirmed && (
          <Alert variant="success" className="border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="font-bold text-emerald-800 dark:text-emerald-300">
              Inventory Decrement Committed
            </AlertTitle>
            <AlertDescription className="text-xs text-emerald-900/80 dark:text-emerald-300/80 space-y-1">
              <p>
                The temporary pessimistic lock was successfully promoted to a permanent inventory decrement transaction.
              </p>
              {hold.confirmedAt && (
                <div className="font-mono text-[11px] pt-1 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Committed At: {new Date(hold.confirmedAt).toLocaleTimeString()} ({new Date(hold.confirmedAt).toLocaleDateString()})</span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Banner */}
        {isExpired && !isConfirmed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">Reservation Lease Expired</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>
                The 5-minute checkout lease has elapsed. The row-lock hold on{' '}
                <code className="font-bold">{hold.itemId}</code> was released back into available inventory.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Backend Mutation Error */}
        {confirmMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Transaction Failed</AlertTitle>
            <AlertDescription className="text-xs">
              {confirmMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2.5 pt-2">
        {!isConfirmed && !isExpired ? (
          <Button
            onClick={handleConfirmPurchase}
            disabled={confirmMutation.isPending || isExpired}
            variant="success"
            size="lg"
            className="w-full sm:flex-1 font-bold gap-2 text-sm h-10 cursor-pointer shadow-sm shadow-emerald-500/20"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing PostgreSQL Commit...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Confirm Purchase ({hold.quantity} units)
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onReset}
            variant="default"
            size="lg"
            className="w-full sm:flex-1 font-bold gap-2 text-sm h-10 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Start New Reservation
          </Button>
        )}

        {!isConfirmed && !isExpired && (
          <Button
            onClick={onReset}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel Hold
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
