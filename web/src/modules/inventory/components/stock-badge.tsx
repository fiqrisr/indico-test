import { Badge } from '@/components/ui/badge'

interface StockBadgeProps {
  availableStock: number
  totalStock: number
}

export function StockBadge({ availableStock, totalStock }: StockBadgeProps) {
  if (totalStock === 0 || availableStock <= 0) {
    return (
      <Badge variant="destructive" className="gap-1.5 py-0.5 px-2">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive-foreground/80" />
        <span>Sold Out</span>
      </Badge>
    )
  }

  if (availableStock <= 10) {
    return (
      <Badge variant="warning" className="gap-1.5 py-0.5 px-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>
        <span className="tabular-nums font-semibold">Low Stock &bull; {availableStock} left</span>
      </Badge>
    )
  }

  return (
    <Badge variant="success" className="gap-1.5 py-0.5 px-2">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="tabular-nums font-semibold">In Stock &bull; {availableStock} available</span>
    </Badge>
  )
}
