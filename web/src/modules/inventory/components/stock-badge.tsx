import { Badge } from '@/components/ui/badge'

interface StockBadgeProps {
  availableStock: number
  totalStock: number
}

export function StockBadge({ availableStock, totalStock }: StockBadgeProps) {
  if (totalStock === 0 || availableStock <= 0) {
    return <Badge variant="destructive">Sold Out</Badge>
  }

  if (availableStock <= 10) {
    return <Badge variant="warning">Low Stock ({availableStock} left)</Badge>
  }

  return <Badge variant="success">In Stock ({availableStock} available)</Badge>
}
