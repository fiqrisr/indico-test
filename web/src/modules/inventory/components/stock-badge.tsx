import { Badge } from '@/components/ui/badge'

interface StockBadgeProps {
  availableStock: number
  totalStock: number
}

export function StockBadge({ availableStock, totalStock }: StockBadgeProps) {
  if (totalStock === 0 || availableStock <= 0) {
    return (
      <Badge variant="destructive" className="rounded-full gap-1.5 py-0.5 px-2.5 shadow-2xs whitespace-nowrap shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400 shrink-0" />
        <span className="font-semibold whitespace-nowrap">Sold Out</span>
      </Badge>
    )
  }

  if (availableStock <= 10) {
    return (
      <Badge variant="warning" className="rounded-full gap-1.5 py-0.5 px-2.5 shadow-2xs whitespace-nowrap shrink-0">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600 dark:bg-amber-400" />
        </span>
        <span className="font-semibold whitespace-nowrap">Low Stock</span>
      </Badge>
    )
  }

  return (
    <Badge variant="success" className="rounded-full gap-1.5 py-0.5 px-2.5 shadow-2xs whitespace-nowrap shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
      <span className="font-semibold whitespace-nowrap">In Stock</span>
    </Badge>
  )
}
