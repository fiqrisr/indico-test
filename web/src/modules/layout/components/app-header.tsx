import { Activity, Database, Lock, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useServiceHealth } from '../hooks/use-service-health'
import { ThemeToggle } from './theme-toggle'

export function AppHeader() {
  const { data: health, isLoading, isError } = useServiceHealth()

  const isHealthy = !isError && health?.status === 'ok'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/85 backdrop-blur-md shadow-xs transition-colors">
      <div className="container max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3.5">
        {/* Brand & System Title */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/40">
              <Zap className="h-5 w-5 text-amber-300 fill-amber-300/40" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-card" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  INDICO
                </span>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  Flash-Sale Engine
                </h1>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-muted-foreground border-border/80">
                  v1.2
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                High-throughput dual-phase holds &bull; PostgreSQL row-level locks
              </p>
            </div>
          </div>

          {/* Mobile Theme Toggle */}
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>

        {/* Operational Status & Technical Badges */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Health Monitor Pill */}
          <div className="flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors px-3 py-1.5 rounded-lg border border-border/80 text-xs">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium hidden sm:inline">Engine API:</span>
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-ping" />
                Connecting...
              </span>
            ) : isHealthy ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Online &bull; Low Latency
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Standalone / Proxying
              </span>
            )}
          </div>

          {/* Engine Technical Guarantees */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[11px]">SELECT FOR UPDATE</span>
            <span className="text-muted-foreground/40">&bull;</span>
            <Lock className="h-3 w-3 text-amber-500" />
            <span className="text-[11px]">Dual-Layer Expiry</span>
          </div>

          {/* Desktop Theme Toggle */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
