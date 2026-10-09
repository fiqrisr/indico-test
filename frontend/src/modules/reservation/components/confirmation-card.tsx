import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  RotateCcw,
  ShieldCheck,
  User,
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
    toast.error('Reservation Expired', {
      description:
        'The 5-minute hold has elapsed. Locked inventory has returned to available stock.',
    })
  }

  const handleConfirmPurchase = async () => {
    if (isLocallyExpired || hold.status === 'EXPIRED') {
      toast.error('Cannot Confirm', {
        description: 'Reservation is expired.',
      })
      return
    }

    try {
      const response = await confirmMutation.mutateAsync({
        reservation_id: hold.reservationId,
        itemId: hold.itemId,
      })
      toast.success('Purchase Confirmed!', {
        description: `Order successfully locked in. Decremented physical stock.`,
      })
      onConfirmSuccess(response.confirmed_at)
    } catch (err: unknown) {
      let msg = 'Failed to confirm reservation'
      if (err instanceof Error) {
        msg = err.message
      }
      toast.error('Confirmation Failed', {
        description: msg,
      })
    }
  }

  const isConfirmed = hold.status === 'CONFIRMED'
  const isExpired = isLocallyExpired || hold.status === 'EXPIRED'

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isConfirmed
                  ? 'bg-success/15 text-success'
                  : isExpired
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-primary/15 text-primary animate-pulse'
              }`}
            >
              {isConfirmed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isExpired ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </span>
            <div>
              <CardTitle className="text-lg font-bold">
                {isConfirmed
                  ? 'Reservation Completed'
                  : isExpired
                  ? 'Reservation Expired'
                  : 'Stock Hold Active'}
              </CardTitle>
              <CardDescription className="text-xs">
                Two-Phase Stock Hold Pipeline
              </CardDescription>
            </div>
          </div>

          <Badge
            variant={
              isConfirmed ? 'success' : isExpired ? 'destructive' : 'default'
            }
            className="text-xs font-semibold px-2.5 py-0.5"
          >
            {isConfirmed ? 'CONFIRMED' : isExpired ? 'EXPIRED' : 'PENDING'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reservation Details Box */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg border text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
              SKU ID
            </span>
            <div className="flex items-center gap-1 font-mono font-semibold text-foreground truncate mt-0.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{hold.itemId}</span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
              Qty Held
            </span>
            <div className="font-semibold text-foreground mt-0.5">
              {hold.quantity} unit(s)
            </div>
          </div>

          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
              User ID
            </span>
            <div className="flex items-center gap-1 font-mono font-semibold text-foreground truncate mt-0.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{hold.userId}</span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
              Hold ID
            </span>
            <div className="font-mono text-muted-foreground truncate mt-0.5" title={hold.reservationId}>
              {hold.reservationId.slice(0, 8)}...
            </div>
          </div>
        </div>

        {/* Live Countdown Timer */}
        {!isConfirmed && (
          <CountdownTimer
            expiresAt={hold.expiresAt}
            onExpire={handleExpire}
          />
        )}

        {/* Confirmed Success Banner */}
        {isConfirmed && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle className="font-bold">Purchase Secured!</AlertTitle>
            <AlertDescription className="text-xs">
              Physical inventory was permanently decremented in PostgreSQL.
              {hold.confirmedAt && (
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Timestamp: {new Date(hold.confirmedAt).toLocaleTimeString()}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Banner */}
        {isExpired && !isConfirmed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">Hold Window Expired</AlertTitle>
            <AlertDescription className="text-xs">
              The 5-minute checkout window has elapsed. The row-lock hold on{' '}
              <code>{hold.itemId}</code> has been released back into available inventory.
            </AlertDescription>
          </Alert>
        )}

        {/* Backend Mutation Error */}
        {confirmMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {confirmMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2 pt-0">
        {!isConfirmed && !isExpired ? (
          <Button
            onClick={handleConfirmPurchase}
            disabled={confirmMutation.isPending || isExpired}
            variant="success"
            className="w-full sm:flex-1 font-bold gap-2 text-sm"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Finalizing Purchase in DB...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Confirm Purchase
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onReset}
            variant="default"
            className="w-full sm:flex-1 font-semibold gap-2 text-sm"
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
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Cancel Hold
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
