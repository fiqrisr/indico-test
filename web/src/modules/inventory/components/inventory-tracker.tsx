import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useInventoryStock } from '../hooks/use-inventory-stock'
import { StockBadge } from './stock-badge'

interface InventoryTrackerProps {
  itemId: string
}

export function InventoryTracker({ itemId }: InventoryTrackerProps) {
  const { data, isLoading, isError, error, isFetching, refetch } =
    useInventoryStock(itemId, { pollingInterval: 2500 })

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-destructive flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" />
              Inventory Sync Interrupted
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 h-8 text-xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </Button>
          </div>
          <CardDescription>
            Could not fetch inventory stock state for SKU:{' '}
            <code className="font-mono text-foreground font-semibold">{itemId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">Engine Error</AlertTitle>
            <AlertDescription className="text-xs">
              {error instanceof Error ? error.message : 'Connection to PostgreSQL inventory service timed out or was refused.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const totalStock = data?.total_stock ?? 0
  const reservedStock = data?.reserved_stock ?? 0
  const availableStock = data?.available_stock ?? 0

  const reservedPercent =
    totalStock > 0 ? Math.round((reservedStock / totalStock) * 100) : 0
  const availablePercent =
    totalStock > 0 ? Math.round((availableStock / totalStock) * 100) : 0

  return (
    <Card className="border-border/80 bg-card shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold">
                Stock Overview
              </CardTitle>
              <span className="font-mono text-xs text-foreground font-medium bg-muted/70 px-2 py-0.5 rounded-md border border-border/80 whitespace-nowrap shrink-0">
                {itemId}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Real-time inventory levels for active checkout sessions
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Clean Sync Indicator */}
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-xs whitespace-nowrap shrink-0">
              <span
                className={`h-2 w-2 rounded-full ${
                  isFetching ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span className="text-foreground text-[11px] font-medium">
                {isFetching ? 'Updating' : 'Live'}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh inventory"
              aria-label="Refresh inventory"
              className="h-8 w-8 rounded-lg cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-muted-foreground ${
                  isFetching ? 'animate-spin text-primary' : ''
                }`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Available Stock (Primary) */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-1">
            <span className="text-xs font-semibold text-primary block">
              Available to Buy
            </span>
            <div className="text-3xl font-extrabold tracking-tight text-primary font-mono tabular-nums">
              {isLoading ? '...' : availableStock}
            </div>
            <div className="pt-1 flex items-center justify-between gap-2 text-xs">
              <StockBadge
                availableStock={availableStock}
                totalStock={totalStock}
              />
              <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
                {availablePercent}%
              </span>
            </div>
          </div>

          {/* Reserved Stock */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-1">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block">
              Held in Checkout
            </span>
            <div className="text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400 font-mono tabular-nums">
              {isLoading ? '...' : reservedStock}
            </div>
            <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Temporary holds</span>
              <span className="font-mono tabular-nums">
                {reservedPercent}%
              </span>
            </div>
          </div>

          {/* Total Stock */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-1">
            <span className="text-xs font-semibold text-foreground block">
              Total Inventory
            </span>
            <div className="text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">
              {isLoading ? '...' : totalStock}
            </div>
            <div className="pt-1 text-xs text-muted-foreground">
              <span>Total catalog units</span>
            </div>
          </div>
        </div>

        {/* Visual Allocation Bar */}
        <div className="space-y-2 rounded-xl bg-muted/30 border border-border/60 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Stock Distribution</span>
            <span className="font-mono text-muted-foreground tabular-nums text-[11px]">
              {availableStock} available / {reservedStock} held
            </span>
          </div>

          {/* Segmented Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden bg-muted flex border border-border/70 p-0.5">
            <div
              className="bg-primary rounded-l-full transition-all duration-300"
              style={{ width: `${availablePercent}%` }}
            />
            <div
              className="bg-amber-500 rounded-r-full transition-all duration-300"
              style={{ width: `${reservedPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Available ({availablePercent}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Held ({reservedPercent}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Simple Explanation Note */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Stock is secured for 5 minutes during checkout. Unconfirmed holds automatically return to available inventory.
        </p>
      </CardContent>
    </Card>
  )
}
