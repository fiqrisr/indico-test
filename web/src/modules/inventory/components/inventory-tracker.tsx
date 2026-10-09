import { AlertCircle, ArrowUpRight, Lock, Package, RefreshCw } from 'lucide-react'
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
      <Card className="border-destructive/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Inventory Sync Failed
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
          <CardDescription>
            Could not fetch inventory stock for SKU:{' '}
            <code className="font-mono">{itemId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Response</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Unknown network error'}
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
    <Card className="shadow-md border-border/80">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Live Stock Monitor
              </CardTitle>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground border">
                {itemId}
              </span>
            </div>
            <CardDescription className="mt-1">
              Real-time PostgreSQL pessimistic lock inventory status
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 text-xs py-1 px-2.5 font-normal bg-card"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isFetching
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-emerald-500 animate-pulse'
                }`}
              />
              {isFetching ? 'Syncing...' : 'Live Polling (2.5s)'}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Manual refresh"
              className="h-8 w-8 cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Stock */}
          <div className="rounded-lg border bg-muted/30 p-4 transition-all">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Total Physical Stock</span>
              <Package className="h-4 w-4 text-muted-foreground/70" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {isLoading ? '...' : totalStock}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Base inventory in warehouse
            </p>
          </div>

          {/* Reserved Stock */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 transition-all">
            <div className="flex items-center justify-between text-warning text-xs font-medium mb-1">
              <span>Reserved (Held)</span>
              <Lock className="h-4 w-4 text-warning" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
              {isLoading ? '...' : reservedStock}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active 5-minute holds pending confirmation
            </p>
          </div>

          {/* Available Stock */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 transition-all">
            <div className="flex items-center justify-between text-primary text-xs font-medium mb-1">
              <span>Available for Flash-Sale</span>
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              {isLoading ? '...' : availableStock}
            </div>
            <div className="mt-1">
              <StockBadge
                availableStock={availableStock}
                totalStock={totalStock}
              />
            </div>
          </div>
        </div>

        {/* Visual Allocation Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Inventory Allocation Breakdown</span>
            <span>
              {availablePercent}% Available &bull; {reservedPercent}% Reserved
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden bg-muted flex border">
            <div
              className="bg-primary transition-all duration-500 ease-out"
              style={{ width: `${availablePercent}%` }}
              title={`Available: ${availableStock} (${availablePercent}%)`}
            />
            <div
              className="bg-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${reservedPercent}%` }}
              title={`Reserved: ${reservedStock} (${reservedPercent}%)`}
            />
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
              <span>Available Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              <span>Pending Holds</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
