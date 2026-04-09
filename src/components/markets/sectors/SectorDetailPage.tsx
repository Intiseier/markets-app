import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Plus, Check } from 'lucide-react'
import { useSectorConstituents } from '@/hooks/use-markets'
import { useAddToWatchlist, useWatchlist } from '@/hooks/use-markets'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtSignedPercent } from '../shared/formatters'

type SortKey = 'weight' | 'price' | 'changePercent' | 'marketCap'
type SortDir = 'asc' | 'desc'

const SECTOR_NAMES: Record<string, string> = {
  XLC: 'Communication Services',
  XLY: 'Consumer Discretionary',
  XLP: 'Consumer Staples',
  XLE: 'Energy',
  XLF: 'Financials',
  XLV: 'Healthcare',
  XLI: 'Industrials',
  XLB: 'Materials',
  XLRE: 'Real Estate',
  XLK: 'Technology',
  XLU: 'Utilities',
}

export function SectorDetailPage() {
  const { key } = useParams<{ key: string }>()
  const navigate = useNavigate()
  const etf = key?.toUpperCase() ?? ''

  const { data, isLoading, isError } = useSectorConstituents(etf)
  const watchlistQuery = useWatchlist()
  const addToWatchlist = useAddToWatchlist()

  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set())

  const watchlistSymbols = new Set((watchlistQuery.data ?? []).map((s) => s.symbol))

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function handleAddToWatchlist(symbol: string) {
    addToWatchlist.mutate(symbol, {
      onSuccess: () => setAddedSymbols((prev) => new Set(prev).add(symbol)),
    })
  }

  const sorted = [...(data?.constituents ?? [])].sort((a, b) => {
    let av: number | null = null
    let bv: number | null = null
    if (sortKey === 'weight') { av = a.weight; bv = b.weight }
    else if (sortKey === 'price') { av = a.price; bv = b.price }
    else if (sortKey === 'changePercent') { av = a.changePercent; bv = b.changePercent }
    else if (sortKey === 'marketCap') {
      // marketCap is formatted string, sort by raw price as proxy
      av = a.price; bv = b.price
    }
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const etfPositive = (data?.changePercent ?? 0) >= 0

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 text-zinc-600" />
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-zinc-400" />
      : <ChevronUp className="h-3 w-3 text-zinc-400" />
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => navigate('/sectors')}
          className="mt-0.5 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        >
          <ArrowLeft size={14} />
          Sectors
        </button>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Sector ETF</div>
          <h1 className="mt-0.5 text-2xl font-semibold text-zinc-100">
            {SECTOR_NAMES[etf] ?? etf}
          </h1>
        </div>

        {/* ETF quote chip */}
        {data && (
          <div className="flex flex-col items-end">
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">
              {fmtPrice(data.price)}
            </div>
            <div className={cn('flex items-center gap-1 text-sm font-medium tabular-nums', etfPositive ? 'text-emerald-400' : 'text-red-400')}>
              {etfPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {fmtSignedPercent(data.changePercent)}
            </div>
            <div className="mt-0.5 text-xs text-zinc-600">{etf}</div>
          </div>
        )}
      </div>

      {/* Data source note */}
      {data && !data.hasFmpData && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-500">
          Showing top holdings from Yahoo Finance. Add an FMP API key in{' '}
          <button type="button" onClick={() => navigate('/settings')} className="text-emerald-500 hover:underline">
            Settings
          </button>{' '}
          to get full holdings with share counts.
        </div>
      )}

      {/* Constituents table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">Top Holdings</div>
          {data && (
            <div className="text-xs text-zinc-500">
              {data.constituents.length} positions
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col divide-y divide-zinc-800/60">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-4 w-12 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            Failed to load constituents for {etf}.
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            No holding data available for {etf}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3">Name</th>
                  <th
                    className="px-5 py-3 cursor-pointer hover:text-zinc-300 select-none"
                    onClick={() => handleSort('weight')}
                  >
                    <div className="flex items-center gap-1">Weight <SortIcon col="weight" /></div>
                  </th>
                  <th
                    className="px-5 py-3 cursor-pointer hover:text-zinc-300 select-none text-right"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></div>
                  </th>
                  <th
                    className="px-5 py-3 cursor-pointer hover:text-zinc-300 select-none text-right"
                    onClick={() => handleSort('changePercent')}
                  >
                    <div className="flex items-center justify-end gap-1">Change <SortIcon col="changePercent" /></div>
                  </th>
                  <th className="px-5 py-3 text-right">Mkt Cap</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {sorted.map((constituent, index) => {
                  const positive = (constituent.changePercent ?? 0) >= 0
                  const inWatchlist = watchlistSymbols.has(constituent.symbol) || addedSymbols.has(constituent.symbol)

                  return (
                    <tr
                      key={constituent.symbol}
                      className="group transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{index + 1}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard?symbol=${constituent.symbol}`)}
                          className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors"
                        >
                          {constituent.symbol}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-zinc-400 max-w-[200px] truncate">{constituent.name}</td>
                      <td className="px-5 py-3 tabular-nums">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500/60"
                            style={{ width: `${Math.min(constituent.weight * 4, 80)}px` }}
                          />
                          <span className="text-zinc-300">{constituent.weight.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-right text-zinc-200">
                        {constituent.price !== null ? fmtPrice(constituent.price) : '--'}
                      </td>
                      <td className={cn('px-5 py-3 tabular-nums text-right font-medium', positive ? 'text-emerald-400' : 'text-red-400')}>
                        {constituent.changePercent !== null ? fmtSignedPercent(constituent.changePercent) : '--'}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-right text-zinc-500 text-xs">
                        {constituent.marketCap ?? '--'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => !inWatchlist && handleAddToWatchlist(constituent.symbol)}
                          disabled={inWatchlist}
                          className={cn(
                            'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                            inWatchlist
                              ? 'text-emerald-500 cursor-default'
                              : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800',
                          )}
                          title={inWatchlist ? 'In watchlist' : 'Add to watchlist'}
                        >
                          {inWatchlist ? <Check size={12} /> : <Plus size={12} />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
