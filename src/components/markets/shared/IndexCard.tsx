import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketIndex } from '@/types/market'
import { fmtPercent, fmtPrice, fmtSignedCurrency } from './formatters'
import { Sparkline } from './Sparkline'

export function IndexCard({
  index,
  selected,
  onSelect,
}: {
  index: MarketIndex
  selected: boolean
  onSelect: (symbol: string) => void
}) {
  const positive = index.changePercent >= 0

  return (
    <button
      type="button"
      onClick={() => onSelect(index.symbol)}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-zinc-900/50 p-4 text-left transition-colors',
        selected ? 'border-blue-500/70 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{index.name}</span>
        <span className={cn('flex items-center gap-1 text-xs font-medium', positive ? 'text-emerald-400' : 'text-red-400')}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {fmtPercent(index.changePercent)}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold leading-none tabular-nums">{fmtPrice(index.price)}</div>
          <div className={cn('mt-1 text-xs tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
            {fmtSignedCurrency(index.change)}
          </div>
        </div>
        <Sparkline data={index.sparkline} positive={positive} width={100} height={36} />
      </div>
    </button>
  )
}
