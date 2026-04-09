import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronUp, ChevronDown, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react'
import { useScreener } from '@/hooks/use-markets'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtSignedPercent } from '../shared/formatters'
import type { ScreenerFilters, ScreenerResult } from '@/types/market'

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Communication Services',
  'Industrials',
  'Energy',
  'Materials',
  'Real Estate',
  'Utilities',
]

const MARKET_CAP_BUCKETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Mega (>$200B)', min: 200_000_000_000, max: undefined },
  { label: 'Large ($10B–$200B)', min: 10_000_000_000, max: 200_000_000_000 },
  { label: 'Mid ($2B–$10B)', min: 2_000_000_000, max: 10_000_000_000 },
  { label: 'Small ($300M–$2B)', min: 300_000_000, max: 2_000_000_000 },
  { label: 'Micro (<$300M)', min: undefined, max: 300_000_000 },
]

type SortKey = keyof Pick<ScreenerResult, 'symbol' | 'price' | 'changePercent' | 'marketCap' | 'peRatio' | 'volume'>
type SortDir = 'asc' | 'desc'

const DEFAULT_FILTERS: ScreenerFilters = { limit: 50 }

export function ScreenerPage() {
  const navigate = useNavigate()

  // Filter state
  const [sector, setSector] = useState('')
  const [capBucket, setCapBucket] = useState(0) // index into MARKET_CAP_BUCKETS
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minChange, setMinChange] = useState('')
  const [maxChange, setMaxChange] = useState('')
  const [minPe, setMinPe] = useState('')
  const [maxPe, setMaxPe] = useState('')
  const [minVolume, setMinVolume] = useState('')

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Build filters for query
  const bucket = MARKET_CAP_BUCKETS[capBucket]
  const filters: ScreenerFilters = {
    ...(sector ? { sector } : {}),
    ...(bucket.min !== undefined ? { minMarketCap: bucket.min } : {}),
    ...(bucket.max !== undefined ? { maxMarketCap: bucket.max } : {}),
    ...(minPrice ? { minPrice: Number(minPrice) } : {}),
    ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
    ...(minChange ? { minChange: Number(minChange) } : {}),
    ...(maxChange ? { maxChange: Number(maxChange) } : {}),
    ...(minPe ? { minPe: Number(minPe) } : {}),
    ...(maxPe ? { maxPe: Number(maxPe) } : {}),
    ...(minVolume ? { minVolume: Number(minVolume) } : {}),
    limit: 100,
  }

  const { data, isLoading, isError, isFetching } = useScreener(filters)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  function resetFilters() {
    setSector('')
    setCapBucket(0)
    setMinPrice('')
    setMaxPrice('')
    setMinChange('')
    setMaxChange('')
    setMinPe('')
    setMaxPe('')
    setMinVolume('')
  }

  const hasActiveFilters =
    sector || capBucket !== 0 || minPrice || maxPrice || minChange || maxChange || minPe || maxPe || minVolume

  const sorted = [...(data?.results ?? [])].sort((a, b) => {
    const av = a[sortKey] as number | string | null
    const bv = b[sortKey] as number | string | null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 text-zinc-700" />
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-zinc-400" />
      : <ChevronUp className="h-3 w-3 text-zinc-400" />
  }

  function FilterInput({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }) {
    return (
      <div>
        <label className="mb-1 block text-xs text-zinc-500">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Any'}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">MarketMeh</div>
          <h1 className="mt-0.5 text-2xl font-semibold text-zinc-100">Screener</h1>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="text-xs text-zinc-500">
              {data.results.length} results
              {data.hasFmpData
                ? ' · via FMP'
                : ' · fallback (add FMP key for full screening)'}
              {isFetching && !isLoading && <span className="ml-2 text-zinc-600">Refreshing…</span>}
            </div>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Filter sidebar */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-zinc-800 p-4">
          <div className="flex flex-col gap-5">
            {/* Sector */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Sector</label>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setSector('')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                    !sector ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                  )}
                >
                  All Sectors
                </button>
                {SECTORS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSector(s === sector ? '' : s)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                      sector === s
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Market cap */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Market Cap</label>
              <div className="flex flex-col gap-1">
                {MARKET_CAP_BUCKETS.map((bucket, i) => (
                  <button
                    key={bucket.label}
                    type="button"
                    onClick={() => setCapBucket(i)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                      capBucket === i
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                    )}
                  >
                    {bucket.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Price ($)</label>
              <div className="grid grid-cols-2 gap-2">
                <FilterInput label="Min" value={minPrice} onChange={setMinPrice} placeholder="0" />
                <FilterInput label="Max" value={maxPrice} onChange={setMaxPrice} placeholder="Any" />
              </div>
            </div>

            {/* % Change */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Change %</label>
              <div className="grid grid-cols-2 gap-2">
                <FilterInput label="Min" value={minChange} onChange={setMinChange} placeholder="-10" />
                <FilterInput label="Max" value={maxChange} onChange={setMaxChange} placeholder="10" />
              </div>
            </div>

            {/* P/E */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">P/E Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <FilterInput label="Min" value={minPe} onChange={setMinPe} placeholder="0" />
                <FilterInput label="Max" value={maxPe} onChange={setMaxPe} placeholder="Any" />
              </div>
            </div>

            {/* Volume */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Min Volume</label>
              <FilterInput label="" value={minVolume} onChange={setMinVolume} placeholder="e.g. 1000000" />
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="min-w-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-zinc-800/50 px-5 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
              Failed to load screener results.
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <div className="text-sm text-zinc-400">No results match your filters.</div>
              <button type="button" onClick={resetFilters} className="text-xs text-emerald-500 hover:underline">
                Clear all filters
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950">
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th
                    className="cursor-pointer select-none px-5 py-3 hover:text-zinc-300"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-1">Symbol <SortIcon col="symbol" /></div>
                  </th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Sector</th>
                  <th
                    className="cursor-pointer select-none px-5 py-3 text-right hover:text-zinc-300"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></div>
                  </th>
                  <th
                    className="cursor-pointer select-none px-5 py-3 text-right hover:text-zinc-300"
                    onClick={() => handleSort('changePercent')}
                  >
                    <div className="flex items-center justify-end gap-1">Chg% <SortIcon col="changePercent" /></div>
                  </th>
                  <th
                    className="cursor-pointer select-none px-5 py-3 text-right hover:text-zinc-300"
                    onClick={() => handleSort('marketCap')}
                  >
                    <div className="flex items-center justify-end gap-1">Mkt Cap <SortIcon col="marketCap" /></div>
                  </th>
                  <th
                    className="cursor-pointer select-none px-5 py-3 text-right hover:text-zinc-300"
                    onClick={() => handleSort('peRatio')}
                  >
                    <div className="flex items-center justify-end gap-1">P/E <SortIcon col="peRatio" /></div>
                  </th>
                  <th
                    className="cursor-pointer select-none px-5 py-3 text-right hover:text-zinc-300"
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-1">Volume <SortIcon col="volume" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {sorted.map((result) => {
                  const positive = (result.changePercent ?? 0) >= 0

                  return (
                    <tr
                      key={result.symbol}
                      className="group cursor-pointer transition-colors hover:bg-zinc-800/30"
                      onClick={() => navigate(`/dashboard?symbol=${result.symbol}`)}
                    >
                      <td className="px-5 py-2.5 font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                        {result.symbol}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-2.5 text-zinc-400">
                        {result.name}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-500">
                        {result.sector ?? '--'}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-right text-zinc-200">
                        {result.price !== null ? fmtPrice(result.price) : '--'}
                      </td>
                      <td className={cn('px-5 py-2.5 tabular-nums text-right font-medium', result.changePercent !== null ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-500')}>
                        {result.changePercent !== null ? (
                          <span className="flex items-center justify-end gap-1">
                            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {fmtSignedPercent(result.changePercent)}
                          </span>
                        ) : '--'}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-right text-zinc-400">
                        {result.marketCapFormatted}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-right text-zinc-400">
                        {result.peRatio !== null ? result.peRatio.toFixed(1) : '--'}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-right text-zinc-400">
                        {result.volumeFormatted}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
