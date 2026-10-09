import { AlertTriangle, Clock } from 'lucide-react'
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
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock
            className={`h-4 w-4 ${
              isExpired
                ? 'text-destructive'
                : isLowTime
                ? 'text-destructive animate-bounce'
                : 'text-primary'
            }`}
          />
          <span className="text-sm font-semibold text-foreground">
            Reservation Hold Window
          </span>
        </div>

        {isExpired ? (
          <Badge variant="destructive" className="animate-pulse">
            EXPIRED
          </Badge>
        ) : isLowTime ? (
          <Badge variant="warning" className="animate-pulse">
            Expiring Soon!
          </Badge>
        ) : (
          <Badge variant="secondary">5-Min Hold Active</Badge>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Time Remaining:</span>
        <span
          className={`font-mono text-2xl font-bold tracking-tight ${
            isExpired
              ? 'text-destructive line-through'
              : isLowTime
              ? 'text-destructive font-black'
              : 'text-foreground'
          }`}
        >
          {formattedTime}
        </span>
      </div>

      <Progress
        value={progressPercentage}
        className="h-2"
        indicatorClassName={
          isExpired
            ? 'bg-destructive'
            : isLowTime
            ? 'bg-destructive animate-pulse'
            : 'bg-primary'
        }
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Allocated Hold: 5m 00s</span>
        {isLowTime && !isExpired && (
          <span className="flex items-center gap-1 text-destructive font-medium">
            <AlertTriangle className="h-3 w-3" />
            Under 1 minute left!
          </span>
        )}
      </div>
    </div>
  )
}
