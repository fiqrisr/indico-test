import { useState } from 'react'
import { Check, Flame, Layers, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <Label className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              Active Flash-Sale Catalog
            </Label>
            <p className="text-xs text-muted-foreground">
              Select a target SKU or enter a custom inventory partition key
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-muted-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/60 self-start sm:self-auto">
          Catalog: {SEEDED_ITEM_PRESETS.length} Seeded SKUs
        </span>
      </div>

      {/* Preset SKU Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SEEDED_ITEM_PRESETS.map((preset) => {
          const isSelected = selectedItemId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectItem(preset.id)}
              className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/6 shadow-sm ring-1 ring-primary/60 dark:bg-primary/10'
                  : 'border-border/80 bg-card/70 hover:border-border hover:bg-muted/40 hover:shadow-2xs'
              }`}
            >
              <div className="w-full">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className={`font-semibold text-sm truncate transition-colors ${
                    isSelected ? 'text-primary font-bold' : 'text-foreground group-hover:text-primary'
                  }`}>
                    {preset.name}
                  </span>
                  {isSelected ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  ) : preset.badge ? (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium shrink-0 bg-muted/50">
                      {preset.badge}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-1 mb-2.5">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between w-full pt-2 border-t border-border/50 text-[11px]">
                <code className="font-mono text-muted-foreground tracking-tight group-hover:text-foreground transition-colors truncate max-w-[150px]">
                  {preset.id}
                </code>
                {isSelected && (
                  <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                    Active
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Custom SKU Form */}
      <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
        <div className="relative flex-1">
          <Package className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            id="custom-item-id"
            placeholder="Enter custom partition key (e.g. flash-sku-99, drop-tier-omega)..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="pl-9 h-9.5 text-xs sm:text-sm font-mono"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="default"
          disabled={!customInput.trim() || customInput.trim() === selectedItemId}
          className="gap-2 shrink-0 h-9.5"
        >
          <Layers className="h-4 w-4 text-primary" />
          Load Custom SKU
        </Button>
      </form>
    </div>
  )
}
