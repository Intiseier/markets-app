import { cn } from '@/lib/utils'
import type { MarketMover } from '@/types/market'
import { fmtCurrency, fmtChange } from './formatters'

export function MoversList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: MarketMover[]
  onSelect: (symbol: string) => void
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">No movers available.</div>
        ) : (
          items.map((item) => {
            const positive = item.changePercent >= 0
            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelect(item.symbol)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-left transition-colors hover:border-zinc-700"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-100">{item.symbol}</div>
                  <div className="truncate text-xs text-zinc-500">{item.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums text-zinc-100">{fmtCurrency(item.price)}</div>
                  <div className={cn('text-xs font-medium tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
                    {fmtChange(item.change, item.changePercent)}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
