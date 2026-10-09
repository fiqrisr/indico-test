import { useState } from 'react'
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
    <div className="relative min-h-screen bg-background flex flex-col text-foreground">
      <AppHeader />

      <main className="flex-1 container max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Product Catalog Selection */}
        <section aria-labelledby="catalog-heading">
          <h2 id="catalog-heading" className="sr-only">Product Catalog</h2>
          <Card className="border-border/80 bg-card shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <ItemSelector
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
              />
            </CardContent>
          </Card>
        </section>

        {/* Primary Operational Grid: Stock Overview & Reservation Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Stock Overview */}
          <section aria-labelledby="stock-heading" className="lg:col-span-6">
            <h2 id="stock-heading" className="sr-only">Stock Overview</h2>
            <InventoryTracker itemId={selectedItemId} />
          </section>

          {/* Right Column: Reservation & Checkout */}
          <section aria-labelledby="reservation-heading" className="lg:col-span-6">
            <h2 id="reservation-heading" className="sr-only">Reservation</h2>
            <ReservationPanel
              itemId={selectedItemId}
              availableStock={availableStock}
            />
          </section>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-border/80 py-4 text-xs text-muted-foreground bg-card">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Indico</span>
            <span>&bull;</span>
            <span>High-concurrency flash sale inventory coordinator</span>
          </div>
          <span className="text-muted-foreground font-mono text-[11px]">
            5-minute hold leases
          </span>
        </div>
      </footer>
    </div>
  )
}
