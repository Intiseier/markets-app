import { useNavigate } from 'react-router'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useMarketSectors } from '@/hooks/use-markets'
import { cn } from '@/lib/utils'
import { fmtPercent } from '../shared/formatters'

const SECTOR_ETF_MAP: Record<string, string> = {
  'Communication Services': 'XLC',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  'Energy': 'XLE',
  'Financials': 'XLF',
  'Healthcare': 'XLV',
  'Industrials': 'XLI',
  'Materials': 'XLB',
  'Real Estate': 'XLRE',
  'Technology': 'XLK',
  'Utilities': 'XLU',
}

export function SectorsPage() {
  const navigate = useNavigate()
  const sectorsQuery = useMarketSectors()
  const sectors = sectorsQuery.data ?? []

  const advancing = sectors.filter((s) => s.changePercent >= 0).length
  const maxAbsChange = Math.max(...sectors.map((s) => Math.abs(s.changePercent)), 1)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">MarketMeh</div>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Sectors</h1>
        {sectors.length > 0 && (
          <p className="mt-1 text-sm text-zinc-500">
            {advancing}/{sectors.length} advancing today
          </p>
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-4">Sector Heatmap</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sectorsQuery.isLoading
            ? Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-800/50" />
              ))
            : sectors.map((sector) => {
                const positive = sector.changePercent >= 0
                const intensity = Math.min(Math.abs(sector.changePercent) / maxAbsChange, 1)
                const etfKey = SECTOR_ETF_MAP[sector.name] ?? sector.name.substring(0, 3).toUpperCase()

                return (
                  <button
                    key={sector.name}
                    type="button"
                    onClick={() => navigate(`/sectors/${etfKey}`)}
                    style={{
                      background: positive
                        ? `rgba(16, 185, 129, ${0.05 + intensity * 0.25})`
                        : `rgba(239, 68, 68, ${0.05 + intensity * 0.25})`,
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-colors hover:brightness-110',
                      positive ? 'border-emerald-500/20' : 'border-red-500/20',
                    )}
                  >
                    <div className="text-xs font-medium text-zinc-400">{etfKey}</div>
                    <div className="mt-1 text-sm font-medium text-zinc-200 leading-tight">{sector.name}</div>
                    <div className={cn('mt-2 text-lg font-bold tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
                      {fmtPercent(sector.changePercent)}
                    </div>
                  </button>
                )
              })}
        </div>
      </div>

      {/* Table view */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-4">Performance Table</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-3 pr-6 font-medium">Sector</th>
                <th className="pb-3 pr-6 font-medium">ETF</th>
                <th className="pb-3 pr-6 font-medium text-right">Today</th>
                <th className="pb-3 font-medium text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sectorsQuery.isLoading
                ? Array.from({ length: 11 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-800/60">
                      <td className="py-3 pr-6"><div className="h-4 w-40 animate-pulse rounded bg-zinc-800" /></td>
                      <td className="py-3 pr-6"><div className="h-4 w-10 animate-pulse rounded bg-zinc-800" /></td>
                      <td className="py-3 pr-6 text-right"><div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-800" /></td>
                      <td className="py-3 text-right"><div className="ml-auto h-4 w-4 animate-pulse rounded bg-zinc-800" /></td>
                    </tr>
                  ))
                : sectors
                    .slice()
                    .sort((a, b) => b.changePercent - a.changePercent)
                    .map((sector) => {
                      const positive = sector.changePercent >= 0
                      const etfKey = SECTOR_ETF_MAP[sector.name] ?? '--'
                      return (
                        <tr
                          key={sector.name}
                          className="border-b border-zinc-800/60 cursor-pointer transition-colors hover:bg-zinc-900/40"
                          onClick={() => navigate(`/sectors/${etfKey}`)}
                        >
                          <td className="py-3 pr-6 font-medium text-zinc-200">{sector.name}</td>
                          <td className="py-3 pr-6 text-zinc-500 font-mono text-xs">{etfKey}</td>
                          <td className={cn('py-3 pr-6 text-right tabular-nums font-semibold', positive ? 'text-emerald-400' : 'text-red-400')}>
                            {fmtPercent(sector.changePercent)}
                          </td>
                          <td className="py-3 text-right">
                            {positive
                              ? <TrendingUp size={16} className="inline text-emerald-500" />
                              : <TrendingDown size={16} className="inline text-red-500" />}
                          </td>
                        </tr>
                      )
                    })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
