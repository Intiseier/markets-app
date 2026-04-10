import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChartRangeKey, MarketChart, MarketChartStyle } from '@/types/market'
import { fmtCurrency, fmtChange, fmtCompactNumber, fmtSignedPercent, formatChartTimestamp, formatDate } from './formatters'
import { EmptyState } from './EmptyState'
import { buildMovingAverage, buildLinePath } from './chart-utils'

const CHART_RANGES: ChartRangeKey[] = ['1d', '1w', '1m', '3m', '6m', '1y', '5y']

type MarketRegime = 'trend-up' | 'trend-down' | 'range-bound' | 'volatile'

function detectRegime(points: MarketChart['points']) {
  if (points.length < 20) return { regime: 'range-bound' as MarketRegime, label: 'Range-Bound', detail: 'Not enough depth for a stronger read.' }

  const sma20Series = buildMovingAverage(points, 20)
  const sma50Series = buildMovingAverage(points, 50)
  const sma20 = sma20Series[sma20Series.length - 1]
  const sma50 = sma50Series[sma50Series.length - 1]
  const recent = points.slice(-20)
  const first = recent[0]?.close ?? points[0]?.close ?? 0
  const last = recent[recent.length - 1]?.close ?? first
  const priceReturn = first !== 0 ? ((last - first) / first) * 100 : 0
  const avgRange =
    recent.reduce((sum, p) => sum + ((p.high ?? p.close) - (p.low ?? p.close)) / Math.max(p.close, 1), 0) /
    Math.max(recent.length, 1)

  if (avgRange > 0.03) return { regime: 'volatile' as MarketRegime, label: 'Volatile', detail: 'Wide intraperiod swings are dominating the tape.' }
  if (sma20 !== null && sma50 !== null && last > sma20 && sma20 > sma50 && priceReturn > 2) {
    return { regime: 'trend-up' as MarketRegime, label: 'Trend Up', detail: 'Short and medium trend structure is stacked upward.' }
  }
  if (sma20 !== null && sma50 !== null && last < sma20 && sma20 < sma50 && priceReturn < -2) {
    return { regime: 'trend-down' as MarketRegime, label: 'Trend Down', detail: 'Short and medium trend structure is stacked downward.' }
  }
  return { regime: 'range-bound' as MarketRegime, label: 'Range-Bound', detail: 'Price is moving without a dominant directional regime.' }
}

function getRegimeClass(regime: MarketRegime) {
  if (regime === 'trend-up') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (regime === 'trend-down') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (regime === 'volatile') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

function normalizeSeries(points: MarketChart['points']) {
  if (points.length === 0) return []
  const first = points[0]?.close ?? 0
  return points.map((p) => (first !== 0 ? (p.close / first) * 100 : 100))
}

export function ChartPanel({
  symbol,
  range,
  chart,
  compareCharts = [],
  isLoading,
  chartStyle,
  onRangeChange,
  initialSma20 = true,
  initialSma50 = true,
  initialVolume = true,
}: {
  symbol: string
  range: ChartRangeKey
  chart?: MarketChart
  compareCharts?: MarketChart[]
  isLoading: boolean
  chartStyle: MarketChartStyle
  onRangeChange: (range: ChartRangeKey) => void
  initialSma20?: boolean
  initialSma50?: boolean
  initialVolume?: boolean
}) {
  const [showSma20, setShowSma20] = useState(initialSma20)
  const [showSma50, setShowSma50] = useState(initialSma50)
  const [showVolume, setShowVolume] = useState(initialVolume)

  const points = chart?.points ?? []
  const hasData = points.length > 1
  const prices = hasData ? points.map((p) => p.close) : []
  const volumes = hasData ? points.map((p) => p.volume ?? 0) : []
  const minPrice = hasData ? Math.min(...prices) : 0
  const maxPrice = hasData ? Math.max(...prices) : 0
  const maxVolume = hasData ? Math.max(...volumes, 1) : 1
  const priceRange = maxPrice - minPrice || 1
  const gradientId = `chart-${symbol.replace(/[^a-zA-Z0-9]/g, '')}-${range}`

  const pricePath = hasData
    ? prices.map((price, index) => {
        const x = (index / (prices.length - 1)) * 100
        const y = ((maxPrice - price) / priceRange) * 100
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      }).join(' ')
    : ''

  const areaPath = hasData ? `${pricePath} L 100 100 L 0 100 Z` : ''
  const positive = chart ? chart.changePercent >= 0 : true
  const lineColor = positive ? '#22c55e' : '#ef4444'
  const sma20 = hasData ? buildMovingAverage(points, 20) : []
  const sma50 = hasData ? buildMovingAverage(points, 50) : []
  const sma20Path = hasData ? buildLinePath(sma20, maxPrice, minPrice) : ''
  const sma50Path = hasData ? buildLinePath(sma50, maxPrice, minPrice) : ''
  const regime = hasData ? detectRegime(points) : { regime: 'range-bound' as MarketRegime, label: 'Range-Bound', detail: 'No chart data.' }

  const comparePalette = ['#60a5fa', '#f59e0b', '#a78bfa', '#22d3ee']
  const compareSeriesSource = hasData
    ? [
        { symbol, color: '#e4e4e7', normalized: normalizeSeries(points) },
        ...compareCharts
          .filter((c) => c.points.length > 1)
          .map((c, index) => ({
            symbol: c.symbol,
            color: comparePalette[index % comparePalette.length],
            normalized: normalizeSeries(c.points),
          })),
      ]
    : []
  const compareValuePool = compareSeriesSource.flatMap((s) => s.normalized)
  const compareMin = compareValuePool.length > 0 ? Math.min(...compareValuePool) : 95
  const compareMax = compareValuePool.length > 0 ? Math.max(...compareValuePool) : 105
  const compareSeries = compareSeriesSource.map((s) => ({
    symbol: s.symbol,
    color: s.color,
    path: buildLinePath(s.normalized, compareMax, compareMin),
    latest: s.normalized[s.normalized.length - 1] ?? 100,
    isBase: s.symbol === symbol,
  }))

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Selected Symbol</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <div className="text-2xl font-bold text-zinc-100">{chart?.name ?? symbol}</div>
            <div className="text-sm font-medium text-zinc-500">{symbol}</div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="text-3xl font-semibold tabular-nums text-zinc-50">
              {chart ? fmtCurrency(chart.price, chart.currency) : '--'}
            </div>
            <div className={cn('text-sm font-medium tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
              {chart ? fmtChange(chart.change, chart.changePercent, chart.currency) : '--'}
            </div>
            {chart?.exchangeName ? <div className="text-sm text-zinc-500">{chart.exchangeName}</div> : null}
            <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getRegimeClass(regime.regime))}>
              {regime.label}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CHART_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRangeChange(option)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                option === range
                  ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                  : 'border-zinc-700 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
              )}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-64 animate-pulse rounded-xl bg-zinc-950/70" />
            <div className="h-24 animate-pulse rounded-xl bg-zinc-950/70" />
          </div>
        ) : hasData && chart ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSma20((v) => !v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showSma20 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
                )}
              >
                SMA20
              </button>
              <button
                type="button"
                onClick={() => setShowSma50((v) => !v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showSma50 ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
                )}
              >
                SMA50
              </button>
              <button
                type="button"
                onClick={() => setShowVolume((v) => !v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showVolume ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-200' : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
                )}
              >
                Volume
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {formatChartTimestamp(points[0].timestamp, range)} to{' '}
                  {formatChartTimestamp(points[points.length - 1].timestamp, range)}
                </span>
                <span>Last updated {formatDate(chart.regularMarketTime)}</span>
              </div>
              <div className="h-64">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                  {chartStyle === 'area' ? (
                    <>
                      <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPath} fill={`url(#${gradientId})`} />
                      <path d={pricePath} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </>
                  ) : chartStyle === 'line' ? (
                    <path d={pricePath} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  ) : (
                    points.map((point, index) => {
                      const open = point.open ?? point.close
                      const high = point.high ?? point.close
                      const low = point.low ?? point.close
                      const close = point.close
                      const x = (index / Math.max(points.length - 1, 1)) * 100
                      const yHigh = ((maxPrice - high) / priceRange) * 100
                      const yLow = ((maxPrice - low) / priceRange) * 100
                      const yOpen = ((maxPrice - open) / priceRange) * 100
                      const yClose = ((maxPrice - close) / priceRange) * 100
                      const candleWidth = Math.max(70 / points.length, 0.6)
                      const bodyTop = Math.min(yOpen, yClose)
                      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1)
                      const candleColor = close >= open ? '#22c55e' : '#ef4444'
                      return (
                        <g key={`${point.timestamp}-${index}`}>
                          <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={candleColor} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                          <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="0.2" fill={candleColor} />
                        </g>
                      )
                    })
                  )}
                  {hasData && (showSma20 || showSma50) ? (
                    <>
                      {showSma20 ? <path d={sma20Path} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" /> : null}
                      {showSma50 ? <path d={sma50Path} fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" vectorEffect="non-scaling-stroke" /> : null}
                    </>
                  ) : null}
                </svg>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>Low {fmtCurrency(minPrice, chart.currency)}</span>
                <span>High {fmtCurrency(maxPrice, chart.currency)}</span>
                <span>{[showSma20 ? 'SMA20' : null, showSma50 ? 'SMA50' : null].filter(Boolean).join(' / ') || 'No moving averages'}</span>
              </div>
            </div>

            {showVolume ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
                  <span>Volume</span>
                  <span>{fmtCompactNumber(maxVolume)}</span>
                </div>
                <div className="h-24">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    {points.map((point, index) => {
                      const width = 100 / points.length
                      const height = ((point.volume ?? 0) / maxVolume) * 100
                      const x = index * width
                      const y = 100 - height
                      return (
                        <rect
                          key={`${point.timestamp}-${index}`}
                          x={x + width * 0.12}
                          y={y}
                          width={Math.max(width * 0.76, 0.8)}
                          height={Math.max(height, 1)}
                          rx="0.5"
                          fill={positive ? '#22c55e88' : '#ef444488'}
                        />
                      )
                    })}
                  </svg>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Regime Detection</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getRegimeClass(regime.regime))}>
                    {regime.label}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{regime.detail}</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Compare Mode</div>
                  <div className="text-xs text-zinc-500">Normalized to 100 at start</div>
                </div>
                {compareSeries.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <div className="h-28">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                        {compareSeries.map((series) => (
                          <path
                            key={series.symbol}
                            d={series.path}
                            fill="none"
                            stroke={series.color}
                            strokeWidth={series.isBase ? '2' : '1.6'}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {compareSeries.map((series) => (
                        <div key={series.symbol} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
                          {series.symbol} {fmtSignedPercent(series.latest - 100)}
                          {series.isBase ? ' baseline' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-500">Add compare tickers in the stock workspace header to overlay relative strength.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No chart data" detail={`Price history for ${symbol} is not available right now.`} />
        )}
      </div>
    </div>
  )
}
