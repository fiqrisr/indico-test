import { useForm } from '@tanstack/react-form'
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReserveStock } from '../hooks/use-reserve-stock'
import type { ReserveStockResponse } from '../types/reservation-types'

interface ReservationFormTanStackProps {
  itemId: string
  availableStock: number
  onSuccess: (data: ReserveStockResponse, userId: string) => void
}

export function ReservationFormTanStack({
  itemId,
  availableStock,
  onSuccess,
}: ReservationFormTanStackProps) {
  const reserveMutation = useReserveStock()

  const form = useForm({
    defaultValues: {
      userId: 'shopper-alpha',
      quantity: 1,
    },
    onSubmit: async ({ value }) => {
      if (availableStock > 0 && value.quantity > availableStock) {
        toast.error('Validation Error', {
          description: `Requested quantity exceeds available stock (${availableStock}).`,
        })
        return
      }

      try {
        const result = await reserveMutation.mutateAsync({
          user_id: value.userId.trim(),
          item_id: itemId,
          quantity: value.quantity,
        })
        toast.success('Pessimistic Hold Granted!', {
          description: `Reserved ${value.quantity} unit(s) of ${itemId}. 5-minute checkout window active.`,
        })
        onSuccess(result, value.userId.trim())
      } catch (err: unknown) {
        let msg = 'Failed to reserve inventory'
        if (err instanceof Error) {
          msg = err.message
        }
        toast.error('Reservation Error', {
          description: msg,
        })
      }
    },
  })

  const isSoldOut = availableStock <= 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      {/* User ID Field */}
      <form.Field
        name="userId"
        validators={{
          onChange: ({ value }) => {
            if (!value || value.trim().length === 0) {
              return 'User ID is required'
            }
            if (value.trim().length < 2) {
              return 'User ID must be at least 2 characters'
            }
            return undefined
          },
        }}
      >
        {(field) => {
          const errorMsg = field.state.meta.errors?.[0]
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label
                  htmlFor="tanstack-userId"
                  className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
                >
                  <User className="h-3.5 w-3.5 text-primary" />
                  Shopper Identifier
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground mr-1 hidden sm:inline">Presets:</span>
                  {['buyer-beta', 'flash-vip', 'speedy-buyer'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => field.handleChange(preset)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-primary bg-muted/60 hover:bg-primary/10 border border-border/60 hover:border-primary/30 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="tanstack-userId"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter client ID (e.g. shopper-alpha)"
                disabled={reserveMutation.isPending || isSoldOut}
                className={errorMsg ? 'border-destructive focus-visible:border-destructive' : ''}
              />
              {errorMsg && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorMsg}
                </p>
              )}
            </div>
          )
        }}
      </form.Field>

      {/* Quantity Field */}
      <form.Field
        name="quantity"
        validators={{
          onChange: ({ value }) => {
            if (!value || value < 1) {
              return 'Quantity must be at least 1'
            }
            if (!Number.isInteger(value)) {
              return 'Quantity must be an integer'
            }
            if (availableStock > 0 && value > availableStock) {
              return `Cannot exceed available stock (${availableStock})`
            }
            return undefined
          },
        }}
      >
        {(field) => {
          const errorMsg = field.state.meta.errors?.[0]
          const currentQty = field.state.value || 1
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="tanstack-quantity"
                  className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  Reservation Quantity
                </Label>
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  Max available: <strong className="text-foreground">{availableStock}</strong> units
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9.5 w-9.5 shrink-0 rounded-lg cursor-pointer"
                  disabled={
                    currentQty <= 1 ||
                    reserveMutation.isPending ||
                    isSoldOut
                  }
                  onClick={() => field.handleChange(Math.max(1, currentQty - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>

                <Input
                  id="tanstack-quantity"
                  type="number"
                  min={1}
                  max={availableStock > 0 ? availableStock : 1}
                  value={currentQty}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  onBlur={field.handleBlur}
                  disabled={reserveMutation.isPending || isSoldOut}
                  className={`text-center font-mono font-bold text-base h-9.5 tabular-nums ${
                    errorMsg ? 'border-destructive' : ''
                  }`}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9.5 w-9.5 shrink-0 rounded-lg cursor-pointer"
                  disabled={
                    (availableStock > 0 && currentQty >= availableStock) ||
                    reserveMutation.isPending ||
                    isSoldOut
                  }
                  onClick={() => field.handleChange(currentQty + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {errorMsg && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorMsg}
                </p>
              )}
            </div>
          )
        }}
      </form.Field>

      {/* Backend Conflict Error Display */}
      {reserveMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {reserveMutation.error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full font-bold gap-2 mt-2 h-11 text-sm shadow-md shadow-primary/20 cursor-pointer"
        disabled={reserveMutation.isPending || isSoldOut}
      >
        {reserveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Acquiring Pessimistic Lock in DB...
          </>
        ) : isSoldOut ? (
          'Physical Stock Exhausted'
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Reserve Flash-Sale Stock
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  )
}
