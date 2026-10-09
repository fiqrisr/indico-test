import { Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useServiceHealth } from '../hooks/use-service-health'
import { ThemeToggle } from './theme-toggle'

export function AppHeader() {
  const { data: health, isLoading, isError } = useServiceHealth()
  const isHealthy = !isError && health?.status === 'ok'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/90 backdrop-blur-md">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Zap className="h-4.5 w-4.5 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Indico
            </span>
            <Badge variant="outline" className="text-[11px] font-medium py-0 px-2 text-foreground/90 border-border/80">
              Flash Sale
            </Badge>
          </div>
        </div>

        {/* System Status & Theme Controls */}
        <div className="flex items-center gap-3">
          {/* Clean Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-border/80 bg-muted/40 text-xs whitespace-nowrap shrink-0">
            {isLoading ? (
              <>
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
                <span className="text-muted-foreground font-medium hidden sm:inline">Connecting</span>
              </>
            ) : isHealthy ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-foreground font-medium hidden sm:inline">Live Engine</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-amber-700 dark:text-amber-400 font-medium hidden sm:inline">Offline Mode</span>
              </>
            )}
          </div>

          {/* Theme Switcher */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
