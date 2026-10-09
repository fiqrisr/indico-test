import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Database,
  Lock,
  Terminal,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
    <div className="relative min-h-screen bg-background flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Subtle Background Blueprint Grid Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,transparent_20%,black_80%)]"
        aria-hidden="true"
      />

      <AppHeader />

      <main className="relative flex-1 container max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Architecture Invariants Telemetry Strip */}
        <section aria-labelledby="invariants-heading">
          <h2 id="invariants-heading" className="sr-only">Architecture Invariants</h2>
          <Card className="relative overflow-hidden border-border/80 bg-card/85 shadow-xs backdrop-blur-md">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500" />
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                      High-Throughput Concurrency Engine
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                      Zero Over-Selling Guaranteed
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-pretty">
                    Stock allocations are safeguarded by PostgreSQL row-level pessimistic locks (<code className="font-mono text-foreground font-semibold px-1 py-0.5 rounded bg-muted">SELECT FOR UPDATE</code>).
                    Temporary holds expire after 5 minutes through dual-layer validation and background Goroutine sweeps.
                  </p>
                </div>

                {/* 3 Technical Guarantee Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto shrink-0">
                  <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 rounded-xl border border-border/70 bg-muted/30 text-left sm:text-center transition-all hover:bg-muted/50 hover:border-primary/40">
                    <div className="flex sm:flex-col items-center gap-2 sm:gap-1">
                      <Lock className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <span className="font-semibold text-xs text-foreground block">Pessimistic Lock</span>
                        <span className="text-muted-foreground text-[10px] font-mono">Row-Level ACID</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="sm:hidden text-[9px] py-0 px-1 font-mono">
                      Active
                    </Badge>
                  </div>

                  <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 rounded-xl border border-border/70 bg-muted/30 text-left sm:text-center transition-all hover:bg-muted/50 hover:border-amber-500/40">
                    <div className="flex sm:flex-col items-center gap-2 sm:gap-1">
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-xs text-foreground block">5-Min TTL Lease</span>
                        <span className="text-muted-foreground text-[10px] font-mono">Auto Reclaim</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="sm:hidden text-[9px] py-0 px-1 font-mono text-amber-600">
                      Enforced
                    </Badge>
                  </div>

                  <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 rounded-xl border border-border/70 bg-muted/30 text-left sm:text-center transition-all hover:bg-muted/50 hover:border-emerald-500/40">
                    <div className="flex sm:flex-col items-center gap-2 sm:gap-1">
                      <Database className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-xs text-foreground block">Strict Isolation</span>
                        <span className="text-muted-foreground text-[10px] font-mono">Read Committed</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="sm:hidden text-[9px] py-0 px-1 font-mono text-emerald-600">
                      Verified
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Item Selection Strip */}
        <section aria-labelledby="catalog-heading">
          <h2 id="catalog-heading" className="sr-only">Inventory Catalog</h2>
          <Card className="border-border/80 bg-card/90 shadow-xs backdrop-blur-xs">
            <CardContent className="p-4 sm:p-5">
              <ItemSelector
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
              />
            </CardContent>
          </Card>
        </section>

        {/* Primary Operational Grid: Live Tracker & Reservation Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Stock Telemetry & Math Blueprint */}
          <section aria-labelledby="telemetry-heading" className="lg:col-span-6 space-y-6">
            <h2 id="telemetry-heading" className="sr-only">Live Stock Telemetry</h2>
            <InventoryTracker itemId={selectedItemId} />

            {/* Invariant Accounting Formula Box */}
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 sm:p-5 space-y-3 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xs tracking-tight">Stock Invariant Specification</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 text-primary border-primary/30">
                  SQL Assertion
                </Badge>
              </div>

              <div className="rounded-xl bg-card border border-border/80 p-3 font-mono text-[11px] sm:text-xs overflow-x-auto text-foreground shadow-2xs">
                <span className="text-primary font-bold">available_stock</span> ={' '}
                <span className="text-foreground">total_stock</span> -{' '}
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  COUNT(active PENDING WHERE expires_at &gt; NOW())
                </span>
              </div>

              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground pt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  When a 5-minute hold expires or is cancelled, row locks release and units automatically revert to available inventory in real time.
                </span>
              </div>
            </div>
          </section>

          {/* Right Column: Two-Phase Reservation Pipeline */}
          <section aria-labelledby="reservation-heading" className="lg:col-span-6">
            <h2 id="reservation-heading" className="sr-only">Reservation Pipeline</h2>
            <ReservationPanel
              itemId={selectedItemId}
              availableStock={availableStock}
            />
          </section>
        </div>
      </main>

      {/* Polish Footer */}
      <footer className="mt-auto border-t border-border/80 py-5 text-xs text-muted-foreground bg-card/60 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-foreground">INDICO Engine</span>
            <span>&bull;</span>
            <span>Dual-Phase Flash-Sale Inventory Coordinator</span>
          </div>

          <div className="flex items-center flex-wrap justify-center gap-2 font-mono text-[11px]">
            <span className="bg-muted/70 px-2 py-0.5 rounded border border-border/60">React 19</span>
            <span className="bg-muted/70 px-2 py-0.5 rounded border border-border/60">Vite 8</span>
            <span className="bg-muted/70 px-2 py-0.5 rounded border border-border/60">Tailwind v4</span>
            <span className="bg-muted/70 px-2 py-0.5 rounded border border-border/60">PostgreSQL Locks</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
