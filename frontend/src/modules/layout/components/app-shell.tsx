import { useState } from 'react'
import {
  Clock,
  Database,
  Info,
  Lock,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InventoryTracker } from '@/modules/inventory/components/inventory-tracker'
import { ItemSelector } from '@/modules/inventory/components/item-selector'
import { useInventoryStock } from '@/modules/inventory/hooks/use-inventory-stock'
import { ReservationPanel } from '@/modules/reservation/components/reservation-panel'
import { AppHeader } from './app-header'

export function AppShell() {
  const [selectedItemId, setSelectedItemId] = useState('flash-item-1')

  const { data: stockData } = useInventoryStock(selectedItemId, {
    pollingInterval: 2500,
  })

  const availableStock = stockData?.available_stock ?? 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Architecture Info Banner */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>High-Concurrency Flash-Sale Invariants</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Inventory reservations are protected by PostgreSQL row-level pessimistic locks (<code>SELECT ... FOR UPDATE</code>).
                  Temporary holds last exactly 5 minutes before automatic background expiration by Go Goroutines.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 shrink-0 text-center text-[11px]">
                <div className="bg-card/80 border rounded p-2 shadow-xs">
                  <Lock className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                  <span className="font-semibold block">Pessimistic</span>
                  <span className="text-muted-foreground text-[10px]">Zero Over-Selling</span>
                </div>
                <div className="bg-card/80 border rounded p-2 shadow-xs">
                  <Clock className="h-3.5 w-3.5 text-amber-500 mx-auto mb-1" />
                  <span className="font-semibold block">5-Min Hold</span>
                  <span className="text-muted-foreground text-[10px]">Dual-Layer Expiry</span>
                </div>
                <div className="bg-card/80 border rounded p-2 shadow-xs">
                  <Database className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-1" />
                  <span className="font-semibold block">PostgreSQL</span>
                  <span className="text-muted-foreground text-[10px]">ACID Integrity</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Item Selection Strip */}
        <div className="bg-card rounded-xl border p-4 shadow-sm">
          <ItemSelector
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
          />
        </div>

        {/* Primary Operational Grid: Live Tracker & Reservation Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Stock Monitor */}
          <div className="lg:col-span-6 space-y-6">
            <InventoryTracker itemId={selectedItemId} />

            <div className="rounded-lg border bg-muted/20 p-4 text-xs space-y-2 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <span>Stock Accounting Formula</span>
              </div>
              <p>
                <code>available_stock = total_stock - COUNT(active PENDING reservations WHERE expires_at &gt; NOW())</code>
              </p>
              <p className="text-[11px]">
                When reservations expire or get canceled, stock is automatically returned to available inventory in real time.
              </p>
            </div>
          </div>

          {/* Right Column: Reservation Workflow & Form */}
          <div className="lg:col-span-6">
            <ReservationPanel
              itemId={selectedItemId}
              availableStock={availableStock}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground bg-card/40">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>High-Throughput Inventory Reservation System &bull; Frontend</span>
          <span className="font-mono text-[11px]">React 19 &bull; Vite 6 &bull; TanStack Query &bull; Shadcn UI</span>
        </div>
      </footer>
    </div>
  )
}
