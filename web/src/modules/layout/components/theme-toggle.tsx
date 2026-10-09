import { Laptop, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme, type Theme } from '../hooks/use-theme'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ]

  return (
    <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 shadow-xs">
      {options.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTheme(value)}
            aria-label={`Switch to ${label} theme`}
            title={`Switch to ${label} theme`}
            className={`h-7 px-2 text-xs font-medium rounded-md gap-1.5 transition-all cursor-pointer ${
              isActive
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        )
      })}
    </div>
  )
}
