import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReserveStock } from '../hooks/use-reserve-stock'
import type { ReserveStockResponse } from '../types/reservation-types'

interface ReservationFormRHFProps {
  itemId: string
  availableStock: number
  onSuccess: (data: ReserveStockResponse, userId: string) => void
}

const reservationSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, 'Shopper ID is required')
    .min(2, 'Shopper ID must be at least 2 characters'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1'),
})

type ReservationFormValues = z.infer<typeof reservationSchema>

export function ReservationFormRHF({
  itemId,
  availableStock,
  onSuccess,
}: ReservationFormRHFProps) {
  const reserveMutation = useReserveStock()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      userId: 'rhf-shopper-1',
      quantity: 1,
    },
  })

  const currentQuantity = watch('quantity') || 1
  const isSoldOut = availableStock <= 0

  useEffect(() => {
    reset({
      userId: 'rhf-shopper-1',
      quantity: 1,
    })
  }, [itemId, reset])

  const onSubmit = async (values: ReservationFormValues) => {
    if (availableStock > 0 && values.quantity > availableStock) {
      toast.error('Validation Error', {
        description: `Requested quantity exceeds available stock (${availableStock}).`,
      })
      return
    }

    try {
      const result = await reserveMutation.mutateAsync({
        user_id: values.userId.trim(),
        item_id: itemId,
        quantity: values.quantity,
      })
      toast.success('Pessimistic Hold Granted!', {
        description: `Reserved ${values.quantity} unit(s) of ${itemId}. 5-minute checkout window active.`,
      })
      onSuccess(result, values.userId.trim())
    } catch (err: unknown) {
      let msg = 'Failed to reserve inventory'
      if (err instanceof Error) {
        msg = err.message
      }
      toast.error('Reservation Error', {
        description: msg,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* User ID Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <Label
            htmlFor="rhf-userId"
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
                onClick={() => setValue('userId', preset, { shouldValidate: true })}
                className="text-[10px] font-mono text-muted-foreground hover:text-primary bg-muted/60 hover:bg-primary/10 border border-border/60 hover:border-primary/30 px-1.5 py-0.5 rounded transition-all cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <Input
          id="rhf-userId"
          {...register('userId')}
          placeholder="Enter client ID (e.g. shopper-alpha)"
          disabled={reserveMutation.isPending || isSoldOut}
          className={errors.userId ? 'border-destructive focus-visible:border-destructive' : ''}
        />
        {errors.userId && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.userId.message}
          </p>
        )}
      </div>

      {/* Quantity Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="rhf-quantity"
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
              currentQuantity <= 1 || reserveMutation.isPending || isSoldOut
            }
            onClick={() =>
              setValue('quantity', Math.max(1, currentQuantity - 1), {
                shouldValidate: true,
              })
            }
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <Input
            id="rhf-quantity"
            type="number"
            min={1}
            max={availableStock > 0 ? availableStock : 1}
            {...register('quantity', { valueAsNumber: true })}
            disabled={reserveMutation.isPending || isSoldOut}
            className={`text-center font-mono font-bold text-base h-9.5 tabular-nums ${
              errors.quantity ? 'border-destructive' : ''
            }`}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9.5 w-9.5 shrink-0 rounded-lg cursor-pointer"
            disabled={
              (availableStock > 0 && currentQuantity >= availableStock) ||
              reserveMutation.isPending ||
              isSoldOut
            }
            onClick={() =>
              setValue('quantity', currentQuantity + 1, {
                shouldValidate: true,
              })
            }
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {errors.quantity && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.quantity.message}
          </p>
        )}
      </div>

      {/* Backend Error Alert */}
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
