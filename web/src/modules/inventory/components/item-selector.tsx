import { useState, useMemo } from 'react'
import { Check, ChevronDown, ChevronUp, Layers, Package, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SEEDED_ITEM_PRESETS } from '../types/inventory-types'

interface ItemSelectorProps {
  selectedItemId: string
  onSelectItem: (itemId: string) => void
}

const CATEGORIES = [
  'All',
  'Gaming',
  'Hardware',
  'Phones',
  'Computing',
  'Audio',
  'Wearables',
  'Lifestyle',
] as const

export function ItemSelector({
  selectedItemId,
  onSelectItem,
}: ItemSelectorProps) {
  const [customInput, setCustomInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customInput.trim()
    if (trimmed.length > 0) {
      onSelectItem(trimmed)
      setCustomInput('')
    }
  }

  // Filter items based on category and search query
  const filteredItems = useMemo(() => {
    return SEEDED_ITEM_PRESETS.filter((preset) => {
      const matchesCategory =
        activeCategory === 'All' || preset.category === activeCategory
      if (!matchesCategory) return false

      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase().trim()
      return (
        preset.name.toLowerCase().includes(query) ||
        preset.id.toLowerCase().includes(query) ||
        preset.description.toLowerCase().includes(query) ||
        (preset.badge && preset.badge.toLowerCase().includes(query)) ||
        (preset.category && preset.category.toLowerCase().includes(query))
      )
    })
  }, [activeCategory, searchQuery])

  // When collapsed and not searching, show top 8 items but ensure selected item is visible
  const visibleItems = useMemo(() => {
    const isFiltering = searchQuery.trim().length > 0 || activeCategory !== 'All'
    if (isFiltering || isExpanded) {
      return filteredItems
    }

    const initialLimit = 8
    const slice = filteredItems.slice(0, initialLimit)
    const isSelectedInSlice = slice.some((item) => item.id === selectedItemId)

    if (!isSelectedInSlice) {
      const selectedItem = filteredItems.find((item) => item.id === selectedItemId)
      if (selectedItem) {
        return [...slice.slice(0, initialLimit - 1), selectedItem]
      }
    }

    return slice
  }, [filteredItems, isExpanded, searchQuery, activeCategory, selectedItemId])

  const isFiltering = searchQuery.trim().length > 0 || activeCategory !== 'All'
  const hasMore = !isFiltering && filteredItems.length > 8

  return (
    <div className="space-y-4">
      {/* Section Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Flash Sale Catalog
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
              {SEEDED_ITEM_PRESETS.length} items
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select an item to inspect real-time PostgreSQL locked stock and reserve units.
          </p>
        </div>

        {/* Quick Filter Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items or SKU..."
            className="pl-8 h-8 text-xs bg-muted/30 focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {CATEGORIES.map((cat) => {
          const count =
            cat === 'All'
              ? SEEDED_ITEM_PRESETS.length
              : SEEDED_ITEM_PRESETS.filter((i) => i.category === cat).length
          const isActive = activeCategory === cat

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat} <span className="text-[10px] opacity-75">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Product Cards Grid */}
      {visibleItems.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-xl border-border/80 text-muted-foreground text-xs">
          No catalog items match &quot;{searchQuery}&quot; in category &quot;{activeCategory}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {visibleItems.map((preset) => {
            const isSelected = selectedItemId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectItem(preset.id)}
                className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40'
                    : 'border-border/80 bg-card hover:border-border hover:bg-muted/30'
                }`}
              >
                <div className="space-y-1.5 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`font-semibold text-xs leading-snug transition-colors line-clamp-1 ${
                        isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
                      }`}
                    >
                      {preset.name}
                    </span>
                    {isSelected ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                        <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                      </span>
                    ) : preset.badge ? (
                      <Badge
                        variant="secondary"
                        className="text-[9px] py-0 px-1 font-semibold shrink-0"
                      >
                        {preset.badge}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full pt-2.5 mt-2.5 border-t border-border/50 text-xs">
                  <span
                    className={`font-mono text-[10px] truncate max-w-[120px] transition-colors ${
                      isSelected
                        ? 'text-foreground/90 font-medium'
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {preset.id}
                  </span>
                  {preset.initialStock ? (
                    <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {preset.initialStock.toLocaleString()} pcs
                    </span>
                  ) : isSelected ? (
                    <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">
                      Selected
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Toggle View All / Show Less */}
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show top 8 items
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                View all {filteredItems.length} catalog items ({filteredItems.length - 8} more)
              </>
            )}
          </Button>
        </div>
      )}

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
            className="pl-9 h-8 text-xs font-mono"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!customInput.trim() || customInput.trim() === selectedItemId}
          className="shrink-0 h-8 px-3 text-xs gap-1.5"
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          Load SKU
        </Button>
      </form>
    </div>
  )
}
