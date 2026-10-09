import { useForm } from '@tanstack/react-form'
import { AlertCircle, ArrowRight, Loader2, Minus, Plus, ShoppingBag, User } from 'lucide-react'
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
      try {
        const result = await reserveMutation.mutateAsync({
          user_id: value.userId.trim(),
          item_id: itemId,
          quantity: value.quantity,
        })
        toast.success('Hold Confirmed! 5-minute checkout window active.', {
          description: `Reserved ${value.quantity} unit(s) of ${itemId}.`,
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="tanstack-userId"
                  className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  User Identifier
                </Label>
                <div className="flex gap-1">
                  {['shopper-1', 'flash-buyer', 'vip-customer'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => field.handleChange(preset)}
                      className="text-[10px] text-primary hover:underline bg-muted/60 px-1.5 py-0.5 rounded cursor-pointer"
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
                placeholder="Enter User ID (e.g. user-8492)"
                disabled={reserveMutation.isPending || isSoldOut}
                className={errorMsg ? 'border-destructive' : ''}
              />
              {errorMsg && (
                <p className="text-xs text-destructive">{errorMsg}</p>
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
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="tanstack-quantity"
                  className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                  Reservation Quantity
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Available: {availableStock}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={
                    field.state.value <= 1 ||
                    reserveMutation.isPending ||
                    isSoldOut
                  }
                  onClick={() =>
                    field.handleChange(Math.max(1, field.state.value - 1))
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>

                <Input
                  id="tanstack-quantity"
                  type="number"
                  min={1}
                  max={availableStock > 0 ? availableStock : 1}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(Number.parseInt(e.target.value, 10) || 1)
                  }
                  onBlur={field.handleBlur}
                  disabled={reserveMutation.isPending || isSoldOut}
                  className={`text-center font-bold ${
                    errorMsg ? 'border-destructive' : ''
                  }`}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={
                    (availableStock > 0 &&
                      field.state.value >= availableStock) ||
                    reserveMutation.isPending ||
                    isSoldOut
                  }
                  onClick={() => field.handleChange(field.state.value + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {errorMsg && (
                <p className="text-xs text-destructive">{errorMsg}</p>
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
        className="w-full font-semibold gap-2 mt-2"
        disabled={reserveMutation.isPending || isSoldOut}
      >
        {reserveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Acquiring Pessimistic Lock...
          </>
        ) : isSoldOut ? (
          'Stock Exhausted'
        ) : (
          <>
            Reserve Flash-Sale Stock
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  )
}
