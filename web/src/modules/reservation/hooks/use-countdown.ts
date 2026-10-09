import { useEffect, useMemo, useRef, useState } from 'react'

interface UseCountdownOptions {
  expiresAt?: string
  totalDurationMs?: number // Default: 5 minutes = 300,000ms
  onExpire?: () => void
}

function calculateRemaining(expiresAt?: string): number {
  if (!expiresAt) return 0
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

export function useCountdown({
  expiresAt,
  totalDurationMs = 5 * 60 * 1000,
  onExpire,
}: UseCountdownOptions) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    calculateRemaining(expiresAt)
  )

  const expiredCallbackCalledRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    expiredCallbackCalledRef.current = false

    if (!expiresAt) {
      return
    }

    const targetTime = new Date(expiresAt).getTime()

    const updateCountdown = () => {
      const now = Date.now()
      const diff = Math.max(0, targetTime - now)
      setRemainingMs(diff)

      if (diff === 0 && !expiredCallbackCalledRef.current) {
        expiredCallbackCalledRef.current = true
        onExpireRef.current?.()
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 250)

    return () => clearInterval(interval)
  }, [expiresAt])

  const { minutes, seconds, formattedTime, progressPercentage, isExpired } =
    useMemo(() => {
      const isExp = remainingMs <= 0
      const totalSec = Math.floor(remainingMs / 1000)
      const mins = Math.floor(totalSec / 60)
      const secs = totalSec % 60

      const pad = (n: number) => n.toString().padStart(2, '0')
      const formatted = `${pad(mins)}:${pad(secs)}`

      const progress = Math.min(
        100,
        Math.max(0, (remainingMs / totalDurationMs) * 100)
      )

      return {
        minutes: mins,
        seconds: secs,
        formattedTime: formatted,
        progressPercentage: progress,
        isExpired: isExp,
      }
    }, [remainingMs, totalDurationMs])

  return {
    remainingMs,
    minutes,
    seconds,
    formattedTime,
    progressPercentage,
    isExpired,
  }
}
