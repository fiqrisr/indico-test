import {
  AlertCircle,
  ArrowUpRight,
  Database,
  Lock,
  Package,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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

  // Calculate contention index
  const contentionLevel =
    totalStock === 0
      ? 'Exhausted'
      : reservedPercent > 70
      ? 'High Contention'
      : reservedPercent > 30
      ? 'Moderate'
      : 'Low Contention'

  return (
    <Card className="border-border/80 bg-card/90 shadow-sm relative overflow-hidden backdrop-blur-xs">
      {/* Subtle top indicator bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/80" />

      <CardHeader className="pb-4 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Live Stock Telemetry
              </CardTitle>
              <span className="font-mono text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded-md border border-border/80 font-medium">
                SKU: {itemId}
              </span>
            </div>
            <CardDescription className="mt-1">
              PostgreSQL row-level lock state synchronized across concurrent transactions
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Live Polling Status Pill */}
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                {isFetching ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </>
                )}
              </span>
              <span className="text-muted-foreground font-medium text-[11px] tabular-nums">
                {isFetching ? 'Syncing...' : 'Live (2.5s Polling)'}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Trigger instant inventory sync"
              aria-label="Trigger instant inventory sync"
              className="h-8 w-8 rounded-lg cursor-pointer hover:bg-muted/70 transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin text-primary' : ''}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Stock */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted/40">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-2">
              <span>Total Physical Stock</span>
              <Package className="h-4 w-4 text-muted-foreground/70" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">
              {isLoading ? (
                <span className="text-muted-foreground/50 text-xl font-normal">Loading...</span>
              ) : (
                totalStock
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
              <span>Warehouse catalog units</span>
            </div>
          </div>

          {/* Reserved Stock */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 dark:bg-amber-500/10">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Active Holds
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                {reservedPercent}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400 font-mono tabular-nums">
              {isLoading ? (
                <span className="text-muted-foreground/50 text-xl font-normal">Loading...</span>
              ) : (
                reservedStock
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 truncate">
              <span>5-min lease holds</span>
              <span className="text-muted-foreground/50">&bull;</span>
              <span className="text-amber-700 dark:text-amber-400/90 font-medium">Pending checkout</span>
            </div>
          </div>

          {/* Available Stock */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/40 hover:bg-primary/8 dark:bg-primary/10">
            <div className="flex items-center justify-between text-primary text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Available to Buy
              </span>
              <span className="text-[10px] font-mono font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                {availablePercent}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary font-mono tabular-nums">
              {isLoading ? (
                <span className="text-muted-foreground/50 text-xl font-normal">Loading...</span>
              ) : (
                availableStock
              )}
            </div>
            <div className="mt-1.5">
              <StockBadge
                availableStock={availableStock}
                totalStock={totalStock}
              />
            </div>
          </div>
        </div>

        {/* Visual Allocation Gauge */}
        <div className="space-y-2.5 pt-1 rounded-xl bg-muted/20 border border-border/60 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-1">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>Real-Time Allocation Breakdown</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
              <span className="text-primary font-semibold">{availableStock} Available ({availablePercent}%)</span>
              <span className="text-muted-foreground/40">&bull;</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{reservedStock} Held ({reservedPercent}%)</span>
            </div>
          </div>

          {/* Segmented Bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden bg-muted/80 flex border border-border/80 shadow-inner p-0.5">
            <div
              className="bg-primary rounded-l-full transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${availablePercent}%` }}
              title={`Available Stock: ${availableStock} (${availablePercent}%)`}
            />
            <div
              className="bg-amber-500 rounded-r-full transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${reservedPercent}%` }}
              title={`Reserved Stock: ${reservedStock} (${reservedPercent}%)`}
            />
          </div>

          {/* Footer of the Allocation Widget */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium text-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-medium text-foreground">Held Leases</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Contention Pressure:</span>
              <Badge
                variant={
                  contentionLevel === 'High Contention'
                    ? 'warning'
                    : contentionLevel === 'Exhausted'
                    ? 'destructive'
                    : 'secondary'
                }
                className="text-[10px] py-0 px-1.5 font-mono"
              >
                {contentionLevel}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
