import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide transition-all select-none',
  {
    variants: {
      variant: {
        default:
          'border-primary/25 bg-primary/10 text-primary dark:text-blue-300 font-semibold hover:bg-primary/15',
        secondary:
          'border-border/60 bg-secondary/80 text-secondary-foreground font-semibold hover:bg-secondary',
        destructive:
          'border-red-500/30 bg-red-500/15 text-red-800 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200 font-semibold hover:bg-red-500/25',
        outline:
          'border-border/80 text-foreground bg-card/60 hover:bg-muted/60',
        success:
          'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200 font-semibold hover:bg-emerald-500/25',
        warning:
          'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200 font-semibold hover:bg-amber-500/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
