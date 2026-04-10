import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WatchlistStock } from '@/types/market'
import { fmtCurrency, fmtChange } from './formatters'
import { Sparkline } from './Sparkline'

export function StockCard({
  stock,
  selected,
  onSelect,
  onRemove,
}: {
  stock: WatchlistStock
  selected: boolean
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
}) {
  const positive = stock.changePercent >= 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(stock.symbol)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(stock.symbol)
        }
      }}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border bg-zinc-900/50 p-4 text-left transition-colors',
        selected ? 'border-blue-500/70 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold">{stock.symbol}</div>
          <div className="max-w-[140px] truncate text-xs text-zinc-500">{stock.name}</div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(stock.symbol)
          }}
          className="hidden h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 group-hover:flex"
          aria-label={`Remove ${stock.symbol}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xl font-bold leading-none tabular-nums">{fmtCurrency(stock.price)}</div>
          <div className={cn('mt-1 text-xs font-medium tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
            {fmtChange(stock.change, stock.changePercent)}
          </div>
        </div>
        <Sparkline data={stock.sparkline} positive={positive} width={80} height={32} />
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Vol: {stock.volume ?? '--'}</span>
        <span>{stock.marketCap ?? '--'}</span>
      </div>
    </div>
  )
}
