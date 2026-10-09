import { AlertTriangle, Clock, ShieldCheck, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useCountdown } from '../hooks/use-countdown'

interface CountdownTimerProps {
  expiresAt: string
  onExpire?: () => void
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const { formattedTime, progressPercentage, isExpired, minutes, seconds } =
    useCountdown({
      expiresAt,
      onExpire,
    })

  const isLowTime = !isExpired && minutes === 0 && seconds <= 60

  return (
    <div
      className={`space-y-3.5 rounded-xl border p-4 transition-all duration-300 ${
        isExpired
          ? 'border-destructive/40 bg-destructive/5'
          : isLowTime
          ? 'border-amber-500/50 bg-amber-500/5 shadow-xs ring-1 ring-amber-500/30'
          : 'border-border/80 bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              isExpired
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : isLowTime
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-primary/20 bg-primary/10 text-primary'
            }`}
          >
            {isExpired ? (
              <Clock className="h-4 w-4" />
            ) : isLowTime ? (
              <AlertTriangle className="h-4 w-4 animate-pulse" />
            ) : (
              <Timer className="h-4 w-4" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold tracking-tight text-foreground block">
              Checkout Window
            </span>
            <span className="text-[11px] text-muted-foreground">
              Items held exclusively for you
            </span>
          </div>
        </div>

        {isExpired ? (
          <Badge variant="destructive" className="animate-pulse font-mono text-[10px]">
            LEASE EXPIRED
          </Badge>
        ) : isLowTime ? (
          <Badge variant="warning" className="animate-pulse font-mono text-[10px] gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            EXPIRING SOON
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono text-[10px] gap-1 text-primary dark:text-blue-300 border-primary/30 dark:border-blue-500/30 bg-primary/5 dark:bg-blue-500/10 font-semibold">
            <ShieldCheck className="h-3 w-3" />
            5-MIN WINDOW
          </Badge>
        )}
      </div>

      {/* Large Digital Clock Face */}
      <div className="flex items-baseline justify-between rounded-lg bg-card/60 border border-border/60 px-4 py-2.5">
        <span className="text-xs text-foreground/80 font-medium">Time Remaining:</span>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-mono text-3xl font-extrabold tracking-tight tabular-nums ${
              isExpired
                ? 'text-destructive line-through opacity-85'
                : isLowTime
                ? 'text-destructive font-black'
                : 'text-foreground'
            }`}
          >
            {formattedTime}
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-medium">
            {isExpired ? 'released' : 'm:s'}
          </span>
        </div>
      </div>

      <Progress
        value={progressPercentage}
        className="h-2"
        indicatorClassName={
          isExpired
            ? 'bg-destructive'
            : isLowTime
            ? 'bg-amber-500 animate-pulse'
            : 'bg-primary'
        }
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
        <span>Total hold time: 5 minutes</span>
        {isLowTime && !isExpired && (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold tabular-nums">
            <AlertTriangle className="h-3 w-3" />
            Under 60 seconds left
          </span>
        )}
      </div>
    </div>
  )
}
