import { Flame, Server, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useServiceHealth } from '../hooks/use-service-health'

export function AppHeader() {
  const { data: health, isLoading, isError } = useServiceHealth()

  const isHealthy = !isError && health?.status === 'ok'

  return (
    <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="container max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Flame className="h-6 w-6 text-amber-300 fill-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Flash-Sale Inventory Engine
              </h1>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                v1.0
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              High-Throughput Two-Phase Hold & Live Reservation Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border text-xs">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Core API:</span>
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-ping" />
                Connecting...
              </span>
            ) : isHealthy ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online (Healthy)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Standalone / Proxying
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border-l pl-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>PostgreSQL Row-Locking</span>
          </div>
        </div>
      </div>
    </header>
  )
}
