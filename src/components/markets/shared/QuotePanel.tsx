import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketQuoteDetail } from '@/types/market'
import { fmtCurrency, fmtCompactNumber, fmtNumber, fmtChange, formatDate } from './formatters'
import { StatItem } from './StatItem'
import { EmptyState } from './EmptyState'

export function QuotePanel({
  symbol,
  quote,
  isLoading,
}: {
  symbol: string
  quote?: MarketQuoteDetail
  isLoading: boolean
}) {
  const positive = quote ? quote.changePercent >= 0 : true

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        <BarChart3 className="h-3.5 w-3.5" />
        Detailed Quote
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-950/70" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
        </div>
      ) : quote ? (
        <div className="mt-4 space-y-4">
          <div>
            <div className="text-2xl font-semibold text-zinc-100">{quote.name}</div>
            <div className="mt-1 text-sm text-zinc-500">{quote.exchangeName || symbol}</div>
            <div className="mt-3 text-3xl font-bold tabular-nums text-zinc-50">{fmtCurrency(quote.price, quote.currency)}</div>
            <div className={cn('mt-1 text-sm font-medium tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
              {fmtChange(quote.change, quote.changePercent, quote.currency)}
            </div>
          </div>

          {quote.sector || quote.industry ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
              {quote.sector ? <span>{quote.sector}</span> : null}
              {quote.sector && quote.industry ? <span className="mx-2 text-zinc-700">|</span> : null}
              {quote.industry ? <span>{quote.industry}</span> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <StatItem label="Open" value={fmtCurrency(quote.stats.open, quote.currency)} />
            <StatItem
              label="Day Range"
              value={
                quote.stats.dayLow !== null && quote.stats.dayHigh !== null
                  ? `${fmtCurrency(quote.stats.dayLow, quote.currency)} – ${fmtCurrency(quote.stats.dayHigh, quote.currency)}`
                  : '--'
              }
            />
            <StatItem label="Prev Close" value={fmtCurrency(quote.stats.previousClose, quote.currency)} />
            <StatItem label="Volume" value={fmtCompactNumber(quote.stats.volume)} />
            <StatItem label="P/E Ratio" value={fmtNumber(quote.stats.peRatio)} />
            <StatItem label="Dividend Yield" value={quote.stats.dividendYield === null ? '--' : `${quote.stats.dividendYield.toFixed(2)}%`} />
            <StatItem label="EPS" value={fmtNumber(quote.stats.eps)} />
            <StatItem label="Avg Volume" value={fmtCompactNumber(quote.stats.avgVolume)} />
            <StatItem label="Market Cap" value={fmtCompactNumber(quote.stats.marketCap)} />
            <StatItem
              label="52W Range"
              value={
                quote.stats.fiftyTwoWeekLow !== null && quote.stats.fiftyTwoWeekHigh !== null
                  ? `${fmtCurrency(quote.stats.fiftyTwoWeekLow, quote.currency)} – ${fmtCurrency(quote.stats.fiftyTwoWeekHigh, quote.currency)}`
                  : '--'
              }
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-500">
            Market state: <span className="font-medium text-zinc-300">{quote.marketState}</span>
            <span className="mx-2 text-zinc-700">|</span>
            Last update: <span className="font-medium text-zinc-300">{formatDate(quote.regularMarketTime)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No quote details" detail={`Detailed quote metrics for ${symbol} are unavailable.`} />
        </div>
      )}
    </div>
  )
}
