import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide transition-all select-none',
  {
    variants: {
      variant: {
        default:
          'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15',
        secondary:
          'border-border/60 bg-secondary/80 text-secondary-foreground hover:bg-secondary',
        destructive:
          'border-destructive/25 bg-destructive/10 text-destructive dark:text-destructive-foreground hover:bg-destructive/15',
        outline:
          'border-border/80 text-foreground bg-card/60 hover:bg-muted/60',
        success:
          'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-500/15',
        warning:
          'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/15',
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
