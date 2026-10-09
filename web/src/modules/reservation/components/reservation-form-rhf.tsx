import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, Loader2, Minus, Plus, ShoppingBag, User } from 'lucide-react'
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
    .min(1, 'User ID is required')
    .min(2, 'User ID must be at least 2 characters'),
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
        description: `Quantity cannot exceed available stock (${availableStock}).`,
      })
      return
    }

    try {
      const result = await reserveMutation.mutateAsync({
        user_id: values.userId.trim(),
        item_id: itemId,
        quantity: values.quantity,
      })
      toast.success('Hold Confirmed! 5-minute checkout window active.', {
        description: `Reserved ${values.quantity} unit(s) of ${itemId}.`,
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
        <div className="flex items-center justify-between">
          <Label
            htmlFor="rhf-userId"
            className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
          >
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            User Identifier (React Hook Form)
          </Label>
          <div className="flex gap-1">
            {['buyer-beta', 'flash-vip', 'speedy-buyer'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setValue('userId', preset, { shouldValidate: true })}
                className="text-[10px] text-primary hover:underline bg-muted/60 px-1.5 py-0.5 rounded cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <Input
          id="rhf-userId"
          {...register('userId')}
          placeholder="Enter User ID"
          disabled={reserveMutation.isPending || isSoldOut}
          className={errors.userId ? 'border-destructive' : ''}
        />
        {errors.userId && (
          <p className="text-xs text-destructive">{errors.userId.message}</p>
        )}
      </div>

      {/* Quantity Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="rhf-quantity"
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
              currentQuantity <= 1 || reserveMutation.isPending || isSoldOut
            }
            onClick={() =>
              setValue('quantity', Math.max(1, currentQuantity - 1), {
                shouldValidate: true,
              })
            }
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
            className={`text-center font-bold ${
              errors.quantity ? 'border-destructive' : ''
            }`}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
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
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {errors.quantity && (
          <p className="text-xs text-destructive">{errors.quantity.message}</p>
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
        className="w-full font-semibold gap-2 mt-2"
        disabled={reserveMutation.isPending || isSoldOut}
      >
        {reserveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Executing Lock & Hold...
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
