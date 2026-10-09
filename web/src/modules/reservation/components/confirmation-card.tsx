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
      toast.success('Purchase Confirmed', {
        description: `Successfully confirmed ${hold.quantity} unit(s) of ${hold.itemId}.`,
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
      className={`relative overflow-hidden border shadow-xs transition-all duration-200 ${
        isConfirmed
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : isExpired
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border/80 bg-card'
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isConfirmed
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : isExpired
                  ? 'border-destructive/30 bg-destructive/15 text-destructive'
                  : 'border-primary/20 bg-primary/10 text-primary'
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
              <CardTitle className="text-base sm:text-lg font-bold">
                {isConfirmed
                  ? 'Purchase Confirmed'
                  : isExpired
                  ? 'Hold Expired'
                  : 'Active Reservation'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isConfirmed
                  ? 'Your order is complete and units are secured'
                  : isExpired
                  ? 'Hold elapsed. Stock has been returned to inventory'
                  : 'Complete purchase before the timer runs out'}
              </CardDescription>
            </div>
          </div>

          <Badge
            variant={
              isConfirmed ? 'success' : isExpired ? 'destructive' : 'default'
            }
            className="text-xs font-mono px-2 py-0.5 uppercase tracking-wider whitespace-nowrap shrink-0"
          >
            {isConfirmed ? 'Confirmed' : isExpired ? 'Expired' : 'Active'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reservation Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/70 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
              Item
            </span>
            <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
              <Package className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{hold.itemId}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
              Quantity
            </span>
            <div className="font-mono font-bold text-foreground tabular-nums text-sm">
              {hold.quantity} {hold.quantity === 1 ? 'unit' : 'units'}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
              Shopper
            </span>
            <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{hold.userId}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
              Hold ID
            </span>
            <div
              className="flex items-center gap-1 font-mono text-foreground font-medium truncate"
              title={hold.reservationId}
            >
              <Fingerprint className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{hold.reservationId.slice(0, 8)}</span>
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
            <AlertTitle className="font-bold text-emerald-900 dark:text-emerald-200">
              Order Successfully Placed
            </AlertTitle>
            <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <p>
                Your reservation has been confirmed and the items are allocated to your account.
              </p>
              {hold.confirmedAt && (
                <div className="font-mono text-[11px] pt-1 text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Confirmed: {new Date(hold.confirmedAt).toLocaleTimeString()} ({new Date(hold.confirmedAt).toLocaleDateString()})</span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Banner */}
        {isExpired && !isConfirmed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">Reservation Expired</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>
                The 5-minute checkout window has elapsed. The hold on{' '}
                <code className="font-bold">{hold.itemId}</code> has been returned to available stock.
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
            className="w-full sm:flex-1 font-bold gap-2 text-sm h-10 cursor-pointer shadow-xs"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Purchase...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Confirm Purchase ({hold.quantity} {hold.quantity === 1 ? 'unit' : 'units'})
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
            New Reservation
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
            Release Hold
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
