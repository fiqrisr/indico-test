import { useState } from 'react'
import { Check, Package, Sparkles } from 'lucide-react'
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
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold tracking-wide text-foreground">
            Active Flash-Sale Catalog
          </Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SEEDED_ITEM_PRESETS.map((preset) => {
            const isSelected = selectedItemId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectItem(preset.id)}
                className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                    : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-medium text-sm text-foreground truncate">
                    {preset.name}
                  </span>
                  {isSelected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : preset.badge ? (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {preset.badge}
                    </Badge>
                  ) : null}
                </div>
                <code className="text-[11px] text-muted-foreground font-mono">
                  {preset.id}
                </code>
              </button>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <Input
            id="custom-item-id"
            placeholder="Or enter custom item_id (e.g. flash-item-3)..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!customInput.trim() || customInput.trim() === selectedItemId}
          className="gap-1.5"
        >
          <Package className="h-3.5 w-3.5" />
          Load SKU
        </Button>
      </form>
    </div>
  )
}
