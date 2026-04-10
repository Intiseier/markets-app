import { cn } from '@/lib/utils'
import type { GlobalMarketAsset } from '@/types/market'
import { fmtPercent, fmtCurrency, fmtSignedCurrency } from './formatters'
import { Sparkline } from './Sparkline'

export function GlobalAssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: GlobalMarketAsset
  selected: boolean
  onSelect: (symbol: string) => void
}) {
  const hasPrice = asset.price !== 0 && asset.price != null
  const positive = asset.changePercent >= 0

  return (
    <button
      type="button"
      onClick={() => onSelect(asset.symbol)}
      className={cn(
        'rounded-xl border bg-zinc-900/50 p-4 text-left transition-colors',
        selected ? 'border-blue-500/70 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{asset.name}</div>
          <div className="text-xs text-zinc-500">{asset.symbol}</div>
        </div>
        {hasPrice && (
          <div className={cn('text-xs font-medium', positive ? 'text-emerald-400' : 'text-red-400')}>{fmtPercent(asset.changePercent)}</div>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tabular-nums text-zinc-100">{hasPrice ? fmtCurrency(asset.price) : '--'}</div>
          <div className={cn('mt-1 text-xs font-medium tabular-nums', hasPrice ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-600')}>
            {hasPrice ? fmtSignedCurrency(asset.change) : 'No data'}
          </div>
        </div>
        {hasPrice && <Sparkline data={asset.sparkline} positive={positive} width={78} height={30} />}
      </div>
    </button>
  )
}
