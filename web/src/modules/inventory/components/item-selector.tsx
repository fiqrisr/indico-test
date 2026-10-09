import { useState } from 'react'
import { Check, Layers, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SEEDED_ITEM_PRESETS } from '../types/inventory-types'

interface ItemSelectorProps {
  selectedItemId: string
  onSelectItem: (itemId: string) => void
}

export function ItemSelector({
  selectedItemId,
  onSelectItem,
}: ItemSelectorProps) {
  const [customInput, setCustomInput] = useState('')

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customInput.trim()
    if (trimmed.length > 0) {
      onSelectItem(trimmed)
      setCustomInput('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Featured Products
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose an item to inspect live stock and reserve units.
          </p>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SEEDED_ITEM_PRESETS.map((preset) => {
          const isSelected = selectedItemId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectItem(preset.id)}
              className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40'
                  : 'border-border/80 bg-card hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="space-y-1.5 w-full">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`font-semibold text-sm transition-colors ${
                      isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
                    }`}
                  >
                    {preset.name}
                  </span>
                  {isSelected ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </span>
                  ) : preset.badge ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5 font-semibold shrink-0"
                    >
                      {preset.badge}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between w-full pt-3 mt-3 border-t border-border/50 text-xs">
                <span
                  className={`font-mono text-[11px] truncate transition-colors ${
                    isSelected
                      ? 'text-foreground/80 font-medium'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {preset.id}
                </span>
                {isSelected && (
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                    Selected
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Custom SKU Bar */}
      <form
        onSubmit={handleCustomSubmit}
        className="flex items-center gap-2 pt-1 max-w-md"
      >
        <div className="relative flex-1">
          <Package className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            id="custom-item-id"
            placeholder="Custom SKU (e.g. drop-sku-99)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="pl-9 h-9 text-xs font-mono"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!customInput.trim() || customInput.trim() === selectedItemId}
          className="shrink-0 h-9 px-3 gap-1.5"
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          Load SKU
        </Button>
      </form>
    </div>
  )
}
