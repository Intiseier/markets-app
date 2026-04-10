import { cn } from '@/lib/utils'
import type { HistoricalInterval, MarketHistoryResponse } from '@/types/market'
import {
  fmtCurrency,
  fmtCompactNumber,
  fmtSignedCurrency,
  fmtSignedPercent,
  formatDateCell,
  formatRawNumber,
  getTodayDate,
  getDateDaysAgo,
} from './formatters'
import { StatItem } from './StatItem'
import { EmptyState } from './EmptyState'

const HISTORY_INTERVALS: HistoricalInterval[] = ['1d', '1wk', '1mo']

const PRESETS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
  { label: '5Y', days: 1825 },
]

export function HistoryPanel({
  symbol,
  history,
  isLoading,
  isDateRangeValid,
  startDate,
  endDate,
  interval,
  onStartDateChange,
  onEndDateChange,
  onIntervalChange,
  onPresetSelect,
  onExport,
}: {
  symbol: string
  history?: MarketHistoryResponse
  isLoading: boolean
  isDateRangeValid: boolean
  startDate: string
  endDate: string
  interval: HistoricalInterval
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onIntervalChange: (value: HistoricalInterval) => void
  onPresetSelect: (days: number) => void
  onExport: () => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Historical Data Workbench</div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">{symbol} OHLC + adjusted close</div>
          <div className="mt-1 text-sm text-zinc-500">
            Choose a date window, switch the sampling interval, and export an Excel-ready CSV for candle work or external models.
          </div>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={!history || history.points.length === 0}
          className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPresetSelect(preset.days)}
              className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(2,minmax(0,180px))_repeat(3,minmax(0,120px))]">
          <div>
            <label htmlFor="history-start" className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
              Start
            </label>
            <input
              id="history-start"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="history-end" className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
              End
            </label>
            <input
              id="history-end"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Interval</div>
            <div className="flex h-10 rounded-lg border border-zinc-700 bg-zinc-950/60 p-1">
              {HISTORY_INTERVALS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onIntervalChange(option)}
                  className={cn(
                    'flex-1 rounded-md text-sm font-medium transition-colors',
                    interval === option ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!isDateRangeValid ? <p className="mt-3 text-sm text-red-400">End date must be on or after the start date.</p> : null}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-zinc-950/70" />
        </div>
      ) : history ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <StatItem label="Rows" value={String(history.summary.rows)} />
            <StatItem label="Highest High" value={fmtCurrency(history.summary.highestHigh, history.currency)} />
            <StatItem label="Lowest Low" value={fmtCurrency(history.summary.lowestLow, history.currency)} />
            <StatItem label="Adj Close" value={fmtCurrency(history.summary.latestAdjClose, history.currency)} />
            <StatItem label="Avg Volume" value={fmtCompactNumber(history.summary.averageVolume)} />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
            Range move:{' '}
            <span className="font-medium text-zinc-100">{fmtSignedCurrency(history.summary.absoluteChange, history.currency)}</span>
            <span className="mx-2 text-zinc-700">|</span>
            Percent:{' '}
            <span className="font-medium text-zinc-100">{fmtSignedPercent(history.summary.percentChange)}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-950/80 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Open</th>
                  <th className="px-3 py-3 font-medium">High</th>
                  <th className="px-3 py-3 font-medium">Low</th>
                  <th className="px-3 py-3 font-medium">Mid</th>
                  <th className="px-3 py-3 font-medium">Close</th>
                  <th className="px-3 py-3 font-medium">Adj Close</th>
                  <th className="px-3 py-3 font-medium">Range %</th>
                  <th className="px-3 py-3 font-medium">Change %</th>
                  <th className="px-3 py-3 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {history.points
                  .slice()
                  .reverse()
                  .map((point) => (
                    <tr key={point.timestamp} className="border-b border-zinc-800/60 last:border-b-0">
                      <td className="px-3 py-3 text-zinc-300">{formatDateCell(point.date)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-200">{fmtCurrency(point.open, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-200">{fmtCurrency(point.high, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-200">{fmtCurrency(point.low, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-200">{fmtCurrency(point.midpoint, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-100">{fmtCurrency(point.close, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-100">{fmtCurrency(point.adjClose, history.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-300">{fmtSignedPercent(point.rangePercent)}</td>
                      <td
                        className={cn(
                          'px-3 py-3 tabular-nums font-medium',
                          (point.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {fmtSignedPercent(point.changePercent)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-300">{fmtCompactNumber(point.volume)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No historical data" detail={`Historical rows for ${symbol} are unavailable for the selected range.`} />
        </div>
      )}
    </div>
  )
}

// Re-export helpers needed by MarketsPage for CSV export
export { getTodayDate, getDateDaysAgo, formatRawNumber }
