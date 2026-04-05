import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  useAddPortfolioPosition,
  useAddToWatchlist,
  useAnalystFeed,
  useGlobalMarkets,
  useMarketChart,
  useMarketCompareCharts,
  useMarketHistory,
  useMarketIndices,
  useMarketInsight,
  useMarketMovers,
  useMarketNews,
  useMarketQuote,
  useMarketSectors,
  usePortfolio,
  useRemoveFromWatchlist,
  useRemovePortfolioPosition,
  useUpdatePortfolioPosition,
  useWatchlist,
} from '@/hooks/use-markets'
import { useSettings } from '@/hooks/use-settings'
import type {
  AnalystActionItem,
  AnalystFeedResponse,
  ChartRangeKey,
  GlobalMarketAsset,
  HistoricalInterval,
  MarketChart,
  MarketChartStyle,
  MarketHistoryResponse,
  MarketIndex,
  MarketInsightResponse,
  MarketMover,
  MarketNews,
  MarketQuoteDetail,
  MarketTone,
  PortfolioPosition,
  SectorPerformance,
  WatchlistStock,
} from '@/types/market'
import { cn } from '@/lib/utils'

const CHART_RANGES: ChartRangeKey[] = ['1d', '1w', '1m', '3m', '6m', '1y', '5y']
const HISTORY_INTERVALS: HistoricalInterval[] = ['1d', '1wk', '1mo']
const BENCHMARK_COMPARE_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA']
const SECTOR_COMPARE_SYMBOLS: Record<string, string> = {
  'Communication Services': 'XLC',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  Energy: 'XLE',
  Financial: 'XLF',
  Financials: 'XLF',
  Healthcare: 'XLV',
  Industrials: 'XLI',
  'Basic Materials': 'XLB',
  Materials: 'XLB',
  'Real Estate': 'XLRE',
  Technology: 'XLK',
  'Utilities': 'XLU',
}

type MarketView = 'overview' | 'portfolio'
type StockDetailTab = 'overview' | 'analyst' | 'insight' | 'history'
type MarketRegime = 'trend-up' | 'trend-down' | 'range-bound' | 'volatile'

interface PortfolioFormState {
  symbol: string
  shares: string
  costBasis: string
  dateAdded: string
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function createDefaultHistoryRange() {
  return {
    startDate: getDateDaysAgo(90),
    endDate: getTodayDate(),
  }
}

function createEmptyPortfolioForm(): PortfolioFormState {
  return {
    symbol: '',
    shares: '',
    costBasis: '',
    dateAdded: getTodayDate(),
  }
}

function Sparkline({
  data,
  positive,
  width = 120,
  height = 40,
}: {
  data: number[]
  positive: boolean
  width?: number
  height?: number
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const points = data.map((value, index) => {
    const x = pad + (index / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (value - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const color = positive ? '#22c55e' : '#ef4444'

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={`M ${points.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function fmtPrice(value: number) {
  const abs = Math.abs(value)
  const digits = abs > 0 && abs < 1 ? 4 : 2
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtCurrency(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const abs = Math.abs(value)
  const digits = abs > 0 && abs < 1 ? 4 : 2
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtSignedCurrency(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${fmtCurrency(Math.abs(value), currency)}`
}

function fmtPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function fmtChange(value: number, percent: number, currency = 'USD') {
  return `${fmtSignedCurrency(value, currency)} (${fmtPercent(percent)})`
}

function fmtCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function timeAgo(unixSec: number) {
  const diff = Math.floor(Date.now() / 1000 - unixSec)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatChartTimestamp(timestamp: number, range: ChartRangeKey) {
  const date = new Date(timestamp * 1000)

  if (range === '1d') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (range === '1w' || range === '1m' || range === '3m') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatDate(unixSec: number | null | undefined) {
  if (!unixSec) return '--'
  return new Date(unixSec * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateCell(date: string) {
  if (!date) return '--'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatRawNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return value.toFixed(digits)
}

function getToneClasses(tone: MarketTone) {
  if (tone === 'bullish') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (tone === 'bearish') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/60 text-zinc-300'
}

function toneLabel(tone: MarketTone) {
  if (tone === 'bullish') return 'Bullish'
  if (tone === 'bearish') return 'Bearish'
  return 'Neutral'
}

function getUpsideTone(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'neutral' as const
  if (value > 0) return 'positive' as const
  if (value < 0) return 'negative' as const
  return 'neutral' as const
}

function getAnalystActionMeta(action: string | null | undefined) {
  const normalized = action?.toLowerCase().trim() ?? ''
  if (normalized.includes('upgrade')) {
    return {
      label: 'Upgrade',
      className: 'border-green-500/30 bg-green-500/10 text-green-300',
    }
  }
  if (normalized.includes('downgrade')) {
    return {
      label: 'Downgrade',
      className: 'border-red-500/30 bg-red-500/10 text-red-300',
    }
  }
  if (normalized.includes('init')) {
    return {
      label: 'Initiated',
      className: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    }
  }
  if (normalized.includes('reiterate') || normalized.includes('maintain')) {
    return {
      label: 'Maintain',
      className: 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
    }
  }
  return {
    label: action || 'Action',
    className: 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
  }
}

function getAnalystRatingTone(rating: string | null | undefined) {
  const normalized = rating?.toLowerCase().trim() ?? ''
  if (normalized.includes('strong buy') || normalized === 'buy' || normalized.includes('outperform') || normalized.includes('overweight')) {
    return 'positive'
  }
  if (normalized.includes('strong sell') || normalized === 'sell' || normalized.includes('underperform') || normalized.includes('underweight')) {
    return 'negative'
  }
  return 'neutral'
}

function getAnalystRatingClass(rating: string | null | undefined) {
  const tone = getAnalystRatingTone(rating)
  if (tone === 'positive') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (tone === 'negative') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

function getAlignmentClass(alignment: 'supportive' | 'mixed' | 'contradictory') {
  if (alignment === 'supportive') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (alignment === 'contradictory') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

function buildMovingAverage(points: MarketChart['points'], period: number) {
  return points.map((_, index) => {
    if (index < period - 1) return null
    const slice = points.slice(index - period + 1, index + 1).map((point) => point.close)
    return slice.reduce((sum, value) => sum + value, 0) / period
  })
}

function buildLinePath(values: Array<number | null>, maxValue: number, minValue: number) {
  const range = maxValue - minValue || 1
  const coords = values
    .map((value, index) => {
      if (value === null) return null
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = ((maxValue - value) / range) * 100
      return { x, y, value }
    })
    .filter((item): item is { x: number; y: number; value: number } => item !== null)

  return coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

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
    recent.reduce((sum, point) => sum + ((point.high ?? point.close) - (point.low ?? point.close)) / Math.max(point.close, 1), 0) /
    Math.max(recent.length, 1)

  if (avgRange > 0.03) {
    return { regime: 'volatile' as MarketRegime, label: 'Volatile', detail: 'Wide intraperiod swings are dominating the tape.' }
  }
  if (sma20 !== null && sma50 !== null && last > sma20 && sma20 > sma50 && priceReturn > 2) {
    return { regime: 'trend-up' as MarketRegime, label: 'Trend Up', detail: 'Short and medium trend structure is stacked upward.' }
  }
  if (sma20 !== null && sma50 !== null && last < sma20 && sma20 < sma50 && priceReturn < -2) {
    return { regime: 'trend-down' as MarketRegime, label: 'Trend Down', detail: 'Short and medium trend structure is stacked downward.' }
  }
  return { regime: 'range-bound' as MarketRegime, label: 'Range-Bound', detail: 'Price is moving without a dominant directional regime.' }
}

function getRegimeClass(regime: MarketRegime) {
  if (regime === 'trend-up') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (regime === 'trend-down') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (regime === 'volatile') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

function normalizeSeries(points: MarketChart['points']) {
  if (points.length === 0) return []
  const first = points[0]?.close ?? 0
  return points.map((point) => (first !== 0 ? (point.close / first) * 100 : 100))
}

function getComparePresets(
  selectedSymbol: string | null,
  sector: string | null | undefined,
  compareSymbols: string[],
) {
  if (!selectedSymbol) return []

  const sectorSymbol = sector ? SECTOR_COMPARE_SYMBOLS[sector] : undefined
  return [sectorSymbol, ...BENCHMARK_COMPARE_SYMBOLS]
    .filter((symbol): symbol is string => Boolean(symbol))
    .filter((symbol, index, array) => array.indexOf(symbol) === index)
    .filter((symbol) => symbol !== selectedSymbol && !compareSymbols.includes(symbol))
}

function getGlobalCategory(symbol: string) {
  if (symbol.endsWith('-USD')) return 'Crypto'
  if (symbol.includes('=F') && symbol.startsWith('EUR')) return 'Forex'
  return 'Commodities'
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center">
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{detail}</div>
    </div>
  )
}

function IndexCard({
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
        <span className={cn('flex items-center gap-1 text-xs font-medium', positive ? 'text-green-400' : 'text-red-400')}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {fmtPercent(index.changePercent)}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold leading-none tabular-nums">{fmtPrice(index.price)}</div>
          <div className={cn('mt-1 text-xs tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
            {fmtSignedCurrency(index.change)}
          </div>
        </div>
        <Sparkline data={index.sparkline} positive={positive} width={100} height={36} />
      </div>
    </button>
  )
}

function StockCard({
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
          <div className={cn('mt-1 text-xs font-medium tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
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

function SectorCard({ sector }: { sector: SectorPerformance }) {
  const positive = sector.changePercent >= 0

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <span className="text-sm font-medium text-zinc-300">{sector.name}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-semibold tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
          {fmtPercent(sector.changePercent)}
        </span>
        {positive ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
      </div>
    </div>
  )
}

function NewsItem({ item }: { item: MarketNews }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-800/50"
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-200 group-hover:text-white">{item.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">{item.source}</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
        {item.tags && item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
    </a>
  )
}

function ChartPanel({
  symbol,
  range,
  chart,
  compareCharts = [],
  isLoading,
  chartStyle,
  onRangeChange,
}: {
  symbol: string
  range: ChartRangeKey
  chart?: MarketChart
  compareCharts?: MarketChart[]
  isLoading: boolean
  chartStyle: MarketChartStyle
  onRangeChange: (range: ChartRangeKey) => void
}) {
  const [showSma20, setShowSma20] = useState(true)
  const [showSma50, setShowSma50] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const points = chart?.points ?? []
  const hasData = points.length > 1
  const prices = hasData ? points.map((point) => point.close) : []
  const volumes = hasData ? points.map((point) => point.volume ?? 0) : []
  const minPrice = hasData ? Math.min(...prices) : 0
  const maxPrice = hasData ? Math.max(...prices) : 0
  const maxVolume = hasData ? Math.max(...volumes, 1) : 1
  const priceRange = maxPrice - minPrice || 1
  const gradientId = `chart-${symbol.replace(/[^a-zA-Z0-9]/g, '')}-${range}`

  const pricePath = hasData
    ? prices
        .map((price, index) => {
          const x = (index / (prices.length - 1)) * 100
          const y = ((maxPrice - price) / priceRange) * 100
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
        })
        .join(' ')
    : ''

  const areaPath = hasData ? `${pricePath} L 100 100 L 0 100 Z` : ''
  const positive = chart ? chart.changePercent >= 0 : true
  const lineColor = positive ? '#22c55e' : '#ef4444'
  const chartStyleLabel = chartStyle === 'candles' ? 'Candles' : chartStyle === 'line' ? 'Line' : 'Area'
  const sma20 = hasData ? buildMovingAverage(points, 20) : []
  const sma50 = hasData ? buildMovingAverage(points, 50) : []
  const sma20Path = hasData ? buildLinePath(sma20, maxPrice, minPrice) : ''
  const sma50Path = hasData ? buildLinePath(sma50, maxPrice, minPrice) : ''
  const regime = hasData ? detectRegime(points) : { regime: 'range-bound' as MarketRegime, label: 'Range-Bound', detail: 'No chart data.' }
  const comparePalette = ['#60a5fa', '#f59e0b', '#a78bfa', '#22d3ee']
  const compareSeriesSource = hasData
    ? [
        {
          symbol,
          color: '#e4e4e7',
          normalized: normalizeSeries(points),
        },
        ...compareCharts
          .filter((item) => item.points.length > 1)
          .map((item, index) => ({
            symbol: item.symbol,
            color: comparePalette[index % comparePalette.length],
            normalized: normalizeSeries(item.points),
          })),
      ]
    : []
  const compareValuePool = compareSeriesSource.flatMap((series) => series.normalized)
  const compareMin = compareValuePool.length > 0 ? Math.min(...compareValuePool) : 95
  const compareMax = compareValuePool.length > 0 ? Math.max(...compareValuePool) : 105
  const compareSeries = compareSeriesSource.map((series) => ({
    symbol: series.symbol,
    color: series.color,
    path: buildLinePath(series.normalized, compareMax, compareMin),
    latest: series.normalized[series.normalized.length - 1] ?? 100,
    isBase: series.symbol === symbol,
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
            <div className={cn('text-sm font-medium tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
              {chart ? fmtChange(chart.change, chart.changePercent, chart.currency) : '--'}
            </div>
            {chart?.exchangeName ? <div className="text-sm text-zinc-500">{chart.exchangeName}</div> : null}
            <div className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {chartStyleLabel}
            </div>
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowSma20((value) => !value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showSma20
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
                )}
              >
                SMA20
              </button>
              <button
                type="button"
                onClick={() => setShowSma50((value) => !value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showSma50
                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
                )}
              >
                SMA50
              </button>
              <button
                type="button"
                onClick={() => setShowVolume((value) => !value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  showVolume
                    ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-200'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-400',
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
                      <path
                        d={pricePath}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : chartStyle === 'line' ? (
                    <path
                      d={pricePath}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
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
                          <line
                            x1={x}
                            y1={yHigh}
                            x2={x}
                            y2={yLow}
                            stroke={candleColor}
                            strokeWidth="0.6"
                            vectorEffect="non-scaling-stroke"
                          />
                          <rect
                            x={x - candleWidth / 2}
                            y={bodyTop}
                            width={candleWidth}
                            height={bodyHeight}
                            rx="0.2"
                            fill={candleColor}
                          />
                        </g>
                      )
                    })
                  )}
                  {hasData && chartStyle !== 'candles' && (showSma20 || showSma50) ? (
                    <>
                      {showSma20 ? (
                        <path
                          d={sma20Path}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="1"
                          strokeDasharray="2 1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      {showSma50 ? (
                        <path
                          d={sma50Path}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1"
                          strokeDasharray="3 1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </>
                  ) : null}
                </svg>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>Low {fmtCurrency(minPrice, chart.currency)}</span>
                <span>High {fmtCurrency(maxPrice, chart.currency)}</span>
                <span>
                  {[showSma20 ? 'SMA20' : null, showSma50 ? 'SMA50' : null].filter(Boolean).join(' / ') || 'No moving averages'}
                </span>
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

function QuotePanel({
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
            <div className={cn('mt-1 text-sm font-medium tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
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
                  ? `${fmtCurrency(quote.stats.dayLow, quote.currency)} - ${fmtCurrency(quote.stats.dayHigh, quote.currency)}`
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
                  ? `${fmtCurrency(quote.stats.fiftyTwoWeekLow, quote.currency)} - ${fmtCurrency(quote.stats.fiftyTwoWeekHigh, quote.currency)}`
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

function HistoryPanel({
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
  const presets = [
    { label: '1W', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1Y', days: 365 },
    { label: '2Y', days: 730 },
    { label: '3Y', days: 1095 },
    { label: '5Y', days: 1825 },
  ]

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
          {presets.map((preset) => (
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
              onChange={(event) => onStartDateChange(event.target.value)}
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
              onChange={(event) => onEndDateChange(event.target.value)}
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
                          (point.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400',
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

function AnalystActionTable({
  title,
  items,
}: {
  title: string
  items: AnalystActionItem[]
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">{title}</div>
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800/70">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Firm</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Rating Change</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const actionMeta = getAnalystActionMeta(item.action)

                return (
                  <tr key={`${item.date}-${item.firm}-${index}`} className="border-b border-zinc-800/50 last:border-b-0">
                    <td className="px-4 py-3 text-zinc-300">{item.date ? formatDateCell(item.date) : '--'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{item.firm ?? item.publisher ?? '--'}</div>
                      {item.publisher && item.publisher !== item.firm ? (
                        <div className="mt-1 text-xs text-zinc-500">{item.publisher}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', actionMeta.className)}>
                        {actionMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-400">
                          {item.priorGrade ?? '--'}
                        </span>
                        <span className="text-zinc-600">-&gt;</span>
                        <span className={cn('rounded-md border px-2 py-1 text-xs font-medium', getAnalystRatingClass(item.newGrade))}>
                          {item.newGrade ?? '--'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <EmptyState title="No actions available" detail="This feed did not return recent analyst actions for the selected symbol." />
        </div>
      )}
    </div>
  )
}

function AnalystPanel({
  symbol,
  analystFeed,
  isLoading,
  hasError = false,
}: {
  symbol: string
  analystFeed?: AnalystFeedResponse
  isLoading: boolean
  hasError?: boolean
}) {
  const consensus = analystFeed?.gradesConsensus
  const targetConsensus = analystFeed?.priceTargetConsensus
  const hasAnalystCoverage = Boolean(
    targetConsensus ||
    (analystFeed?.priceTargetSummary.length ?? 0) > 0 ||
    consensus?.rating ||
    (analystFeed?.latestActions.length ?? 0) > 0 ||
    (analystFeed?.historicalActions.length ?? 0) > 0,
  )
  const totalRatings =
    (consensus?.strongBuy ?? 0) +
    (consensus?.buy ?? 0) +
    (consensus?.hold ?? 0) +
    (consensus?.sell ?? 0) +
    (consensus?.strongSell ?? 0)
  const upsideTone = getUpsideTone(targetConsensus?.upsidePercent)
  const actionCounts = {
    upgrades: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('upgrade')).length ?? 0,
    downgrades: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('downgrade')).length ?? 0,
    maintains: analystFeed?.latestActions.filter((item) => {
      const action = (item.action ?? '').toLowerCase()
      return action.includes('maintain') || action.includes('reiterate')
    }).length ?? 0,
    initiations: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('init')).length ?? 0,
  }
  const ratingBars = [
    { label: 'Strong Buy', value: consensus?.strongBuy ?? 0, className: 'bg-green-400' },
    { label: 'Buy', value: consensus?.buy ?? 0, className: 'bg-emerald-300' },
    { label: 'Hold', value: consensus?.hold ?? 0, className: 'bg-zinc-400' },
    { label: 'Sell', value: consensus?.sell ?? 0, className: 'bg-amber-300' },
    { label: 'Strong Sell', value: consensus?.strongSell ?? 0, className: 'bg-red-400' },
  ]
  const revisionPoints = (analystFeed?.targetRevision ?? []).filter((point) => point.value !== null)
  const revisionValues = revisionPoints.map((point) => point.value ?? 0)
  const revisionMin = revisionValues.length > 0 ? Math.min(...revisionValues) : 0
  const revisionMax = revisionValues.length > 0 ? Math.max(...revisionValues) : 0
  const revisionPath = revisionPoints.length > 1 ? buildLinePath(revisionValues, revisionMax, revisionMin) : ''
  const currentTargetValue =
    targetConsensus?.consensus ??
    revisionPoints[revisionPoints.length - 1]?.value ??
    null
  const providerLimitNote = analystFeed?.note?.toLowerCase().includes('rate-limit') || analystFeed?.note?.toLowerCase().includes('plan has reached')
  const providerRejectedNote = analystFeed?.note?.toLowerCase().includes('rejected the saved api key')

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Dedicated Analyst Feed</div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">Consensus targets, upgrades, downgrades</div>
          <div className="mt-1 text-sm text-zinc-500">
            This uses a dedicated analyst-data provider instead of inferring sentiment from headlines alone.
          </div>
        </div>

        {analystFeed?.configured ? (
          <div className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1 text-xs uppercase tracking-wider text-zinc-300">
            {analystFeed.provider}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-zinc-950/70" />
        </div>
      ) : hasError ? (
        <div className="mt-4">
          <EmptyState
            title="Analyst feed unavailable"
            detail={`The analyst provider request for ${symbol} failed just now. Try refresh; if it keeps happening, the provider may be throttling or temporarily unavailable.`}
          />
        </div>
      ) : analystFeed?.configured ? (
        hasAnalystCoverage ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Consensus Target</div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="text-4xl font-semibold tabular-nums text-zinc-50">{fmtCurrency(targetConsensus?.consensus)}</div>
                    <div
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
                        upsideTone === 'positive' && 'border-green-500/30 bg-green-500/10 text-green-300',
                        upsideTone === 'negative' && 'border-red-500/30 bg-red-500/10 text-red-300',
                        upsideTone === 'neutral' && 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
                      )}
                    >
                      {fmtSignedPercent(targetConsensus?.upsidePercent)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-500">
                    Current {fmtCurrency(analystFeed.currentPrice)} | Median {fmtCurrency(targetConsensus?.median)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatItem label="Target High" value={fmtCurrency(targetConsensus?.high)} />
                  <StatItem label="Target Low" value={fmtCurrency(targetConsensus?.low)} />
                  <StatItem label="Analysts" value={targetConsensus?.analystCount !== null ? String(targetConsensus?.analystCount) : '--'} />
                  <StatItem label="Street Rating" value={consensus?.rating ?? '--'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatItem label="Upgrades" value={String(actionCounts.upgrades)} />
              <StatItem label="Downgrades" value={String(actionCounts.downgrades)} />
              <StatItem label="Maintains" value={String(actionCounts.maintains)} />
              <StatItem label="Initiations" value={String(actionCounts.initiations)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Consensus Breakdown</div>
                <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getAnalystRatingClass(consensus?.rating))}>
                  {consensus?.rating ?? '--'}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {ratingBars.map((bar) => {
                  const width = totalRatings > 0 ? (bar.value / totalRatings) * 100 : 0
                  return (
                    <div key={bar.label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-300">{bar.label}</span>
                        <span className="tabular-nums text-zinc-500">
                          {bar.value}
                          {totalRatings > 0 ? ` | ${((bar.value / totalRatings) * 100).toFixed(0)}%` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div className={cn('h-2 rounded-full', bar.className)} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatItem label="Strong Buy" value={String(consensus?.strongBuy ?? '--')} />
                <StatItem label="Buy" value={String(consensus?.buy ?? '--')} />
                <StatItem label="Hold" value={String(consensus?.hold ?? '--')} />
                <StatItem label="Sell" value={String(consensus?.sell ?? '--')} />
                <StatItem label="Strong Sell" value={String(consensus?.strongSell ?? '--')} />
                <StatItem label="Ratings Count" value={totalRatings > 0 ? String(totalRatings) : '--'} />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Price Target Windows</div>
              <div className="mt-3 space-y-2">
                {analystFeed.priceTargetSummary.length > 0 ? (
                  analystFeed.priceTargetSummary.map((window) => (
                    <div key={window.label} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100">{window.label}</div>
                        <div className="text-xs text-zinc-500">
                          {window.analystCount !== null ? `${window.analystCount} analysts` : 'Analyst count unavailable'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-zinc-100">{fmtCurrency(window.consensus)}</div>
                        <div className="text-xs text-zinc-500">
                          {targetConsensus && targetConsensus.consensus !== null && window.consensus !== null
                            ? `${fmtSignedPercent(((window.consensus - targetConsensus.consensus) / targetConsensus.consensus) * 100)} vs current consensus`
                            : '--'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No target windows" detail={`The provider did not return target windows for ${symbol}.`} />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Target Revision Snapshot</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Shows how the provider&apos;s target windows stack up against the current consensus target.
                </div>
              </div>
              <div className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs uppercase tracking-wider text-zinc-300">
                Current consensus {fmtCurrency(currentTargetValue)}
              </div>
            </div>

            {revisionPoints.length > 0 ? (
              <div className="mt-4 space-y-4">
                {revisionPoints.length > 1 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="h-24">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                        <path
                          d={revisionPath}
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>Lowest window {fmtCurrency(revisionMin)}</span>
                      <span>Highest window {fmtCurrency(revisionMax)}</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {revisionPoints.map((point) => {
                    const deltaPercent =
                      currentTargetValue !== null && point.value !== null && currentTargetValue !== 0
                        ? ((point.value - currentTargetValue) / currentTargetValue) * 100
                        : null

                    return (
                      <div key={point.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="text-xs uppercase tracking-wider text-zinc-500">{point.label}</div>
                        <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{fmtCurrency(point.value)}</div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {point.analystCount !== null ? `${point.analystCount} analysts` : 'Analyst count unavailable'}
                        </div>
                        <div
                          className={cn(
                            'mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                            deltaPercent !== null && deltaPercent > 0 && 'border-green-500/30 bg-green-500/10 text-green-300',
                            deltaPercent !== null && deltaPercent < 0 && 'border-red-500/30 bg-red-500/10 text-red-300',
                            (deltaPercent === null || deltaPercent === 0) && 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
                          )}
                        >
                          {deltaPercent === null ? '--' : `${fmtSignedPercent(deltaPercent)} vs current`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState title="No revision snapshot" detail={`The provider did not return target-window history for ${symbol}.`} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AnalystActionTable title="Latest Analyst Actions" items={analystFeed.latestActions} />
            <AnalystActionTable title="Historical Analyst Actions" items={analystFeed.historicalActions} />
          </div>
        </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={
                providerLimitNote
                  ? 'Analyst provider limit reached'
                  : providerRejectedNote
                    ? 'Analyst provider rejected the key'
                    : 'No analyst coverage for this symbol'
              }
              detail={analystFeed.note ?? `The provider is connected, but it did not return analyst targets or rating actions for ${symbol}.`}
            />
          </div>
        )
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Analyst feed not configured"
            detail={analystFeed?.note ?? 'Add an analyst-data API key to enable consensus targets and grade changes.'}
          />
        </div>
      )}
    </div>
  )
}

function InsightPanel({
  symbol,
  insight,
  isLoading,
  onOpenTab,
}: {
  symbol: string
  insight?: MarketInsightResponse
  isLoading: boolean
  onOpenTab: (tab: StockDetailTab) => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Street View + Mason View</div>
      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-100">Multi-horizon outlook</div>
          <div className="mt-1 text-sm text-zinc-500">
            This combines real headline tone with a Mason-style read on momentum, volatility, and participation.
          </div>
        </div>

        {insight ? (
          <div className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider', getToneClasses(insight.overallTone))}>
            {toneLabel(insight.overallTone)}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
        </div>
      ) : insight ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Trust Notes</div>
              <div className="mt-3 space-y-2">
                {insight.trustNotes.map((note) => (
                  <div key={note} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Methodology</div>
              <div className="mt-3 space-y-2">
                {insight.methodology.map((step) => (
                  <div key={step} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Data Freshness</div>
              <div className="mt-3 space-y-3 text-sm text-zinc-300">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Market data: <span className="text-zinc-100">{formatDate(insight.dataFreshness.marketDataTime)}</span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Analyst feed: <span className="text-zinc-100">{formatDate(insight.dataFreshness.analystDataTime)}</span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Headline count: <span className="text-zinc-100">{insight.dataFreshness.headlineCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Street Summary</div>
              <div className="mt-2 text-sm leading-6 text-zinc-200">{insight.streetSummary}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2 py-1">Positive: {insight.signals.positive}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Negative: {insight.signals.negative}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Analyst mentions: {insight.signals.analystMentions}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Street rating: {insight.analystContext.rating ?? '--'}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Target drift: {fmtSignedPercent(insight.analystContext.upsidePercent)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Mason Summary</div>
              <div className="mt-2 text-sm leading-6 text-zinc-200">{insight.masonSummary}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Support: {fmtCurrency(insight.keyLevels.support)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Resistance: {fmtCurrency(insight.keyLevels.resistance)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Avg Volume: {fmtCompactNumber(insight.keyLevels.averageVolume)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Upgrades / Downgrades: {insight.analystContext.upgrades}/{insight.analystContext.downgrades}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {insight.horizons.map((horizon) => (
              <div key={horizon.key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{horizon.label}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                      Conviction {horizon.conviction}
                    </div>
                  </div>
                  <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getToneClasses(horizon.tone))}>
                    {toneLabel(horizon.tone)}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
                      <span>Confidence</span>
                      <span>{horizon.confidenceScore}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          horizon.confidenceScore >= 70
                            ? 'bg-green-400'
                            : horizon.confidenceScore >= 55
                              ? 'bg-amber-300'
                              : 'bg-red-400',
                        )}
                        style={{ width: `${horizon.confidenceScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getAlignmentClass(horizon.analystAlignment))}>
                      Analyst Alignment: {horizon.analystAlignment}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Conviction: {horizon.conviction}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatItem label="Return" value={fmtSignedPercent(horizon.priceChangePercent)} />
                  <StatItem label="Volatility" value={fmtPercent(horizon.volatilityPercent)} />
                  <StatItem label="Volume Shift" value={fmtSignedPercent(horizon.volumeTrendPercent)} />
                  <StatItem
                    label="Levels"
                    value={
                      horizon.support !== null && horizon.resistance !== null
                        ? `${fmtCurrency(horizon.support)} / ${fmtCurrency(horizon.resistance)}`
                        : '--'
                    }
                  />
                </div>

                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Street</div>
                    <p className="mt-1">{horizon.streetView}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Mason</div>
                    <p className="mt-1">{horizon.masonView}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Why This View</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {horizon.drivers.map((driver) => (
                      <span key={driver} className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300">
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Inspect Inputs</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTab('overview')}
                      className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      Open Price Structure
                    </button>
                    {(Math.abs(horizon.scoreBreakdown.analystTarget) > 0 ||
                      Math.abs(horizon.scoreBreakdown.analystRating) > 0 ||
                      Math.abs(horizon.scoreBreakdown.analystActions) > 0) ? (
                      <button
                        type="button"
                        onClick={() => onOpenTab('analyst')}
                        className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                      >
                        Open Analyst Feed
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenTab('history')}
                      className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      Open History Table
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Score Breakdown</div>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <table className="min-w-full text-xs">
                      <tbody>
                        {[
                          ['Price Trend', horizon.scoreBreakdown.priceTrend],
                          ['Volume Trend', horizon.scoreBreakdown.volumeTrend],
                          ['Headline Tone', horizon.scoreBreakdown.headlineTone],
                          ['Analyst Target', horizon.scoreBreakdown.analystTarget],
                          ['Analyst Rating', horizon.scoreBreakdown.analystRating],
                          ['Analyst Actions', horizon.scoreBreakdown.analystActions],
                          ['Volatility Penalty', horizon.scoreBreakdown.volatilityPenalty],
                          ['Data Depth Adj.', horizon.scoreBreakdown.dataDepthAdjustment],
                          ['Alignment Adj.', horizon.scoreBreakdown.analystAlignmentAdjustment],
                          ['Raw Composite', horizon.scoreBreakdown.rawComposite],
                        ].map(([label, value]) => {
                          const numericValue = Number(value)
                          return (
                            <tr key={String(label)} className="border-b border-zinc-800/60 last:border-b-0">
                              <td className="px-3 py-2 text-zinc-400">{label}</td>
                              <td
                                className={cn(
                                  'px-3 py-2 text-right font-medium tabular-nums',
                                  numericValue > 0 ? 'text-green-300' : numericValue < 0 ? 'text-red-300' : 'text-zinc-300',
                                )}
                              >
                                {numericValue >= 0 ? '+' : ''}
                                {numericValue.toFixed(3)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Risk Flags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {horizon.risks.map((risk) => (
                      <span key={risk} className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-200">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent {symbol} headlines</div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
              {insight.headlines.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-800/60">
                  {insight.headlines.map((item) => (
                    <NewsItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState title="No recent headlines" detail={`Fresh coverage for ${symbol} is thin right now.`} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No market outlook yet" detail={`The intelligence layer for ${symbol} is unavailable right now.`} />
        </div>
      )}
    </div>
  )
}

function MoversList({
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
                  <div className={cn('text-xs font-medium tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
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

function GlobalAssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: GlobalMarketAsset
  selected: boolean
  onSelect: (symbol: string) => void
}) {
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
        <div className={cn('text-xs font-medium', positive ? 'text-green-400' : 'text-red-400')}>{fmtPercent(asset.changePercent)}</div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tabular-nums text-zinc-100">{fmtCurrency(asset.price)}</div>
          <div className={cn('mt-1 text-xs font-medium tabular-nums', positive ? 'text-green-400' : 'text-red-400')}>
            {fmtSignedCurrency(asset.change)}
          </div>
        </div>
        <Sparkline data={asset.sparkline} positive={positive} width={78} height={30} />
      </div>
    </button>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone === 'positive' && 'text-green-400',
          tone === 'negative' && 'text-red-400',
          tone === 'neutral' && 'text-zinc-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function MarketsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useSettings()
  const defaultHistoryRange = createDefaultHistoryRange()
  const [activeView, setActiveView] = useState<MarketView>('overview')
  const [tickerInput, setTickerInput] = useState('')
  const [workspaceSymbolInput, setWorkspaceSymbolInput] = useState('')
  const [compareSymbolInput, setCompareSymbolInput] = useState('')
  const [compareSymbols, setCompareSymbols] = useState<string[]>([])
  const [addError, setAddError] = useState('')
  const [compareError, setCompareError] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<StockDetailTab>('overview')
  const [selectedRange, setSelectedRange] = useState<ChartRangeKey>('1m')
  const [historyStartDate, setHistoryStartDate] = useState(defaultHistoryRange.startDate)
  const [historyEndDate, setHistoryEndDate] = useState(defaultHistoryRange.endDate)
  const [historyInterval, setHistoryInterval] = useState<HistoricalInterval>('1d')
  const [portfolioForm, setPortfolioForm] = useState<PortfolioFormState>(createEmptyPortfolioForm())
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [portfolioError, setPortfolioError] = useState('')

  const indicesQuery = useMarketIndices()
  const watchlistQuery = useWatchlist()
  const newsQuery = useMarketNews()
  const sectorsQuery = useMarketSectors()
  const moversQuery = useMarketMovers()
  const globalMarketsQuery = useGlobalMarkets()
  const portfolioQuery = usePortfolio()
  const chartQuery = useMarketChart(selectedSymbol, selectedRange)
  const quoteQuery = useMarketQuote(selectedSymbol)
  const historyQuery = useMarketHistory(selectedSymbol, {
    startDate: historyStartDate,
    endDate: historyEndDate,
    interval: historyInterval,
  })
  const insightQuery = useMarketInsight(selectedSymbol)
  const analystFeedQuery = useAnalystFeed(selectedSymbol)
  const compareChartQueries = useMarketCompareCharts(compareSymbols, selectedRange)
  const chartStyle = settingsQuery.data?.marketPreferences.chartStyle ?? 'area'

  const addMutation = useAddToWatchlist()
  const removeMutation = useRemoveFromWatchlist()
  const addPositionMutation = useAddPortfolioPosition()
  const updatePositionMutation = useUpdatePortfolioPosition()
  const removePositionMutation = useRemovePortfolioPosition()

  const anyQueryLoading =
    indicesQuery.isLoading ||
    watchlistQuery.isLoading ||
    newsQuery.isLoading ||
    sectorsQuery.isLoading ||
    moversQuery.isLoading ||
    globalMarketsQuery.isLoading ||
    portfolioQuery.isLoading ||
    chartQuery.isLoading ||
    quoteQuery.isLoading ||
    historyQuery.isLoading ||
    insightQuery.isLoading ||
    analystFeedQuery.isLoading ||
    settingsQuery.isLoading

  const anyMutationPending =
    addMutation.isPending ||
    removeMutation.isPending ||
    addPositionMutation.isPending ||
    updatePositionMutation.isPending ||
    removePositionMutation.isPending

  const globalGroups: Record<string, GlobalMarketAsset[]> = {
    Crypto: [],
    Forex: [],
    Commodities: [],
  }

  for (const asset of globalMarketsQuery.data ?? []) {
    globalGroups[getGlobalCategory(asset.symbol)].push(asset)
  }

  const sp500 = (indicesQuery.data ?? []).find((index) => index.symbol === '^GSPC')
  const advancingSectors = (sectorsQuery.data ?? []).filter((sector) => sector.changePercent >= 0).length
  const totalSectors = sectorsQuery.data?.length ?? 0
  const watchlistAdvancers = (watchlistQuery.data ?? []).filter((stock) => stock.changePercent >= 0).length
  const totalWatchlist = watchlistQuery.data?.length ?? 0
  const topMover = moversQuery.data?.gainers?.[0]
  const workspaceShortcuts = [
    ...(watchlistQuery.data ?? []).slice(0, 8).map((stock) => stock.symbol),
    ...(indicesQuery.data ?? []).slice(0, 4).map((index) => index.symbol),
  ].filter((symbol, index, array) => array.indexOf(symbol) === index && symbol !== selectedSymbol)
  const compareCharts = compareChartQueries
    .map((query) => query.data)
    .filter((chart): chart is MarketChart => Boolean(chart))
  const comparePresets = getComparePresets(selectedSymbol, quoteQuery.data?.sector, compareSymbols).slice(0, 4)

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['markets'] })
  }

  function handleSelectSymbol(symbol: string) {
    setSelectedSymbol(symbol)
    setDetailTab('overview')
    setActiveView('overview')
  }

  function handleCloseSymbolDetail() {
    setSelectedSymbol(null)
    setDetailTab('overview')
  }

  function handleOpenWorkspaceSymbol() {
    const symbol = workspaceSymbolInput.trim().toUpperCase()
    if (!symbol) return
    handleSelectSymbol(symbol)
    setWorkspaceSymbolInput('')
  }

  function addCompareSymbol(symbol: string) {
    if (!symbol) return

    if (symbol === selectedSymbol) {
      setCompareError('The active symbol is already the baseline.')
      return
    }

    if (compareSymbols.includes(symbol)) {
      setCompareError('That compare ticker is already active.')
      return
    }

    if (compareSymbols.length >= 4) {
      setCompareError('Compare mode supports up to four extra tickers.')
      return
    }

    setCompareSymbols((current) => [...current, symbol])
    setCompareError('')
  }

  function handleAddCompareSymbol() {
    const symbol = compareSymbolInput.trim().toUpperCase()
    addCompareSymbol(symbol)
    if (symbol) {
      setCompareSymbolInput('')
    }
  }

  function handleRemoveCompareSymbol(symbol: string) {
    setCompareSymbols((current) => current.filter((item) => item !== symbol))
    setCompareError('')
  }

  function applyHistoryPreset(days: number) {
    setHistoryEndDate(getTodayDate())
    setHistoryStartDate(getDateDaysAgo(days))
  }

  function exportHistoryCsv() {
    if (!historyQuery.data || historyQuery.data.points.length === 0) return

    const headers = ['Date', 'Open', 'High', 'Low', 'Midpoint', 'Close', 'Adjusted Close', 'Range %', 'Change %', 'Volume']
    const rows = historyQuery.data.points.map((point) =>
      [
        point.date,
        formatRawNumber(point.open),
        formatRawNumber(point.high),
        formatRawNumber(point.low),
        formatRawNumber(point.midpoint),
        formatRawNumber(point.close),
        formatRawNumber(point.adjClose),
        formatRawNumber(point.rangePercent, 4),
        formatRawNumber(point.changePercent, 4),
        formatRawNumber(point.volume, 0),
      ].join(','),
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedSymbol ?? 'market-history'}-${historyStartDate}-to-${historyEndDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleAddWatchlistTicker() {
    const symbol = tickerInput.trim().toUpperCase()
    if (!symbol) return

    setAddError('')
    addMutation.mutate(symbol, {
      onError: () => setAddError('Could not add ticker. Check the symbol or try again.'),
      onSuccess: () => {
        setTickerInput('')
        setSelectedSymbol(symbol)
      },
    })
  }

  function handleRemoveWatchlistTicker(symbol: string) {
    removeMutation.mutate(symbol)
  }

  function resetPortfolioForm() {
    setPortfolioForm(createEmptyPortfolioForm())
    setEditingSymbol(null)
    setPortfolioError('')
  }

  function handleEditPosition(position: PortfolioPosition) {
    setActiveView('portfolio')
    setEditingSymbol(position.symbol)
    setPortfolioError('')
    setPortfolioForm({
      symbol: position.symbol,
      shares: String(position.shares),
      costBasis: String(position.costBasis),
      dateAdded: position.dateAdded,
    })
  }

  function handleDeletePosition(symbol: string) {
    setPortfolioError('')
    removePositionMutation.mutate(symbol, {
      onError: () => setPortfolioError('Could not remove that position.'),
      onSuccess: () => {
        if (editingSymbol === symbol) {
          resetPortfolioForm()
        }
      },
    })
  }

  function handleSubmitPosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbol = portfolioForm.symbol.trim().toUpperCase()
    const shares = Number(portfolioForm.shares)
    const costBasis = Number(portfolioForm.costBasis)
    const dateAdded = portfolioForm.dateAdded

    if (!symbol) {
      setPortfolioError('Symbol is required.')
      return
    }

    if (!Number.isFinite(shares) || shares <= 0) {
      setPortfolioError('Shares must be greater than zero.')
      return
    }

    if (!Number.isFinite(costBasis) || costBasis < 0) {
      setPortfolioError('Cost basis must be zero or greater.')
      return
    }

    if (!dateAdded) {
      setPortfolioError('Date added is required.')
      return
    }

    setPortfolioError('')

    const payload = {
      symbol,
      shares,
      costBasis,
      dateAdded,
    }

    if (editingSymbol) {
      updatePositionMutation.mutate(
        { symbol: editingSymbol, position: payload },
        {
          onError: () => setPortfolioError('Could not update the portfolio position.'),
          onSuccess: () => resetPortfolioForm(),
        },
      )
      return
    }

    addPositionMutation.mutate(payload, {
      onError: () => setPortfolioError('Could not add the portfolio position.'),
      onSuccess: () => resetPortfolioForm(),
    })
  }

  const portfolioTotals = portfolioQuery.data?.totals
  const totalPlTone =
    (portfolioTotals?.totalPlDollar ?? 0) > 0 ? 'positive' : (portfolioTotals?.totalPlDollar ?? 0) < 0 ? 'negative' : 'neutral'
  const isHistoryDateRangeValid = historyStartDate <= historyEndDate

  useEffect(() => {
    if (!selectedSymbol) return
    const nextRange = createDefaultHistoryRange()
    setSelectedRange('3m')
    setHistoryStartDate(nextRange.startDate)
    setHistoryEndDate(nextRange.endDate)
    setHistoryInterval('1d')
    setCompareSymbols([])
    setCompareSymbolInput('')
    setCompareError('')
  }, [selectedSymbol])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader title="Markets" subtitle="Daily Market Report" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-zinc-700 bg-zinc-900/70 p-1">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'overview' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('portfolio')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'portfolio' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <Wallet className="h-3.5 w-3.5" />
              Portfolio
            </button>
          </div>

          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (anyQueryLoading || anyMutationPending) && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {activeView === 'overview' ? (
        selectedSymbol ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={handleCloseSymbolDetail}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back To Market Snapshot
                  </button>
                  <div className="mt-4 text-xs uppercase tracking-wider text-zinc-500">Stock Workspace</div>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <div className="text-3xl font-semibold text-zinc-100">{quoteQuery.data?.name ?? chartQuery.data?.name ?? selectedSymbol}</div>
                    <div className="text-sm font-medium uppercase tracking-wider text-zinc-500">{selectedSymbol}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1">
                      Chart Style: {chartStyle === 'candles' ? 'Candles' : chartStyle === 'line' ? 'Line' : 'Area'}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1">
                      Street Rating: {analystFeedQuery.data?.gradesConsensus?.rating ?? '--'}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1">
                      Target Drift: {fmtSignedPercent(analystFeedQuery.data?.priceTargetConsensus?.upsidePercent)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={workspaceSymbolInput}
                      onChange={(event) => setWorkspaceSymbolInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => event.key === 'Enter' && handleOpenWorkspaceSymbol()}
                      placeholder="Jump to symbol..."
                      className="h-10 w-40 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleOpenWorkspaceSymbol}
                      disabled={!workspaceSymbolInput.trim()}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                    >
                      Open
                    </button>
                  </div>

                  <div className="flex rounded-xl border border-zinc-700 bg-zinc-950/60 p-1">
                    {([
                      ['overview', 'Overview'],
                      ['analyst', 'Analyst'],
                      ['insight', 'Street + Mason'],
                      ['history', 'History'],
                    ] as Array<[StockDetailTab, string]>).map(([tabKey, label]) => (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setDetailTab(tabKey)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                          detailTab === tabKey ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
                <StatItem label="Last Price" value={fmtCurrency(quoteQuery.data?.price ?? chartQuery.data?.price)} />
                <StatItem
                  label="Day Move"
                  value={
                    quoteQuery.data
                      ? fmtChange(quoteQuery.data.change, quoteQuery.data.changePercent, quoteQuery.data.currency)
                      : '--'
                  }
                />
                <StatItem label="Target" value={fmtCurrency(analystFeedQuery.data?.priceTargetConsensus?.consensus)} />
                <StatItem label="Street" value={analystFeedQuery.data?.gradesConsensus?.rating ?? '--'} />
                <StatItem
                  label="Support / Resistance"
                  value={
                    insightQuery.data?.keyLevels.support !== null && insightQuery.data?.keyLevels.resistance !== null
                      ? `${fmtCurrency(insightQuery.data?.keyLevels.support)} / ${fmtCurrency(insightQuery.data?.keyLevels.resistance)}`
                      : '--'
                  }
                />
              </div>

              {workspaceShortcuts.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Jump Rail</div>
                  <div className="flex flex-wrap gap-2">
                    {workspaceShortcuts.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => handleSelectSymbol(symbol)}
                        className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Compare Mode</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Add up to four tickers to compare normalized relative strength against {selectedSymbol}.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={compareSymbolInput}
                      onChange={(event) => setCompareSymbolInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => event.key === 'Enter' && handleAddCompareSymbol()}
                      placeholder="Add compare..."
                      className="h-10 w-40 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCompareSymbol}
                      disabled={!compareSymbolInput.trim()}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
                    >
                      Add Compare
                    </button>
                  </div>
                </div>

                {compareSymbols.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {compareSymbols.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => handleRemoveCompareSymbol(symbol)}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                      >
                        {symbol}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                ) : null}

                {comparePresets.length > 0 ? (
                  <div className="mt-3">
                    <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Quick Presets</div>
                    <div className="flex flex-wrap gap-2">
                      {comparePresets.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => addCompareSymbol(symbol)}
                          className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {compareError ? <div className="mt-3 text-sm text-amber-300">{compareError}</div> : null}
              </div>
            </div>

            {detailTab === 'overview' ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                <ChartPanel
                  symbol={selectedSymbol}
                  range={selectedRange}
                  chart={chartQuery.data}
                  compareCharts={compareCharts}
                  isLoading={chartQuery.isLoading}
                  chartStyle={chartStyle}
                  onRangeChange={setSelectedRange}
                />
                <QuotePanel symbol={selectedSymbol} quote={quoteQuery.data} isLoading={quoteQuery.isLoading} />
              </div>
            ) : null}

            {detailTab === 'analyst' ? (
              <AnalystPanel
                symbol={selectedSymbol}
                analystFeed={analystFeedQuery.data}
                isLoading={analystFeedQuery.isLoading}
                hasError={analystFeedQuery.isError}
              />
            ) : null}

            {detailTab === 'insight' ? (
              <InsightPanel
                symbol={selectedSymbol}
                insight={insightQuery.data}
                isLoading={insightQuery.isLoading}
                onOpenTab={setDetailTab}
              />
            ) : null}

            {detailTab === 'history' ? (
              <HistoryPanel
                symbol={selectedSymbol}
                history={historyQuery.data}
                isLoading={historyQuery.isLoading}
                isDateRangeValid={isHistoryDateRangeValid}
                startDate={historyStartDate}
                endDate={historyEndDate}
                interval={historyInterval}
                onStartDateChange={setHistoryStartDate}
                onEndDateChange={setHistoryEndDate}
                onIntervalChange={setHistoryInterval}
                onPresetSelect={applyHistoryPreset}
                onExport={exportHistoryCsv}
              />
            ) : null}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="S&P 500"
                value={sp500 ? `${fmtPrice(sp500.price)} (${fmtPercent(sp500.changePercent)})` : '--'}
                tone={sp500 ? (sp500.changePercent >= 0 ? 'positive' : 'negative') : 'neutral'}
              />
              <SummaryCard
                label="Sector Breadth"
                value={totalSectors > 0 ? `${advancingSectors}/${totalSectors} positive` : '--'}
                tone={advancingSectors > totalSectors / 2 ? 'positive' : advancingSectors < totalSectors / 2 ? 'negative' : 'neutral'}
              />
              <SummaryCard
                label="Watchlist Breadth"
                value={totalWatchlist > 0 ? `${watchlistAdvancers}/${totalWatchlist} up` : '--'}
                tone={watchlistAdvancers > totalWatchlist / 2 ? 'positive' : watchlistAdvancers < totalWatchlist / 2 ? 'negative' : 'neutral'}
              />
              <SummaryCard
                label="Lead Gainer"
                value={topMover ? `${topMover.symbol} ${fmtPercent(topMover.changePercent)}` : '--'}
                tone={topMover ? 'positive' : 'neutral'}
              />
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Major Indices</h2>
              {indicesQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {(indicesQuery.data ?? []).map((index) => (
                    <IndexCard key={index.symbol} index={index} selected={false} onSelect={handleSelectSymbol} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Watchlist</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={tickerInput}
                    onChange={(event) => {
                      setTickerInput(event.target.value.toUpperCase())
                      setAddError('')
                    }}
                    onKeyDown={(event) => event.key === 'Enter' && handleAddWatchlistTicker()}
                    placeholder="Add ticker..."
                    className="h-9 w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddWatchlistTicker}
                    disabled={addMutation.isPending || !tickerInput.trim()}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {addError ? <p className="mb-2 text-xs text-red-400">{addError}</p> : null}

              {watchlistQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {(watchlistQuery.data ?? []).map((stock) => (
                    <StockCard
                      key={stock.symbol}
                      stock={stock}
                      selected={false}
                      onSelect={handleSelectSymbol}
                      onRemove={handleRemoveWatchlistTicker}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Top Gainers & Losers</h2>
                {moversQuery.isLoading ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[...Array(2)].map((_, index) => (
                      <div key={index} className="h-72 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MoversList title="Top Gainers" items={moversQuery.data?.gainers ?? []} onSelect={handleSelectSymbol} />
                    <MoversList title="Top Losers" items={moversQuery.data?.losers ?? []} onSelect={handleSelectSymbol} />
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Global Markets</h2>
                {globalMarketsQuery.isLoading ? (
                  <div className="grid grid-cols-1 gap-4">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(globalGroups).map(([groupName, assets]) => (
                      <div key={groupName} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="mb-3 text-sm font-semibold text-zinc-100">{groupName}</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {assets.map((asset) => (
                            <GlobalAssetCard key={asset.symbol} asset={asset} selected={false} onSelect={handleSelectSymbol} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sector Performance</h2>
                <div className="flex flex-col gap-2">
                  {sectorsQuery.isLoading
                    ? [...Array(6)].map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                      ))
                    : (sectorsQuery.data ?? []).map((sector) => <SectorCard key={sector.symbol} sector={sector} />)}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Market News</h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
                  {newsQuery.isLoading ? (
                    <div className="flex flex-col divide-y divide-zinc-800">
                      {[...Array(6)].map((_, index) => (
                        <div key={index} className="px-3 py-3">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-zinc-800/60">
                      {(newsQuery.data ?? []).slice(0, 10).map((item) => (
                        <NewsItem key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )
      ) : (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Value" value={fmtCurrency(portfolioTotals?.totalMarketValue)} />
            <SummaryCard label="Total Cost" value={fmtCurrency(portfolioTotals?.totalCost)} />
            <SummaryCard
              label="Total P&L"
              value={
                portfolioTotals
                  ? `${fmtSignedCurrency(portfolioTotals.totalPlDollar)} (${fmtPercent(portfolioTotals.totalPlPercent)})`
                  : '--'
              }
              tone={totalPlTone}
            />
            <SummaryCard
              label="Positions"
              value={String(portfolioQuery.data?.positions.length ?? 0)}
              tone="neutral"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{editingSymbol ? 'Edit Position' : 'Add Position'}</div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">
                {editingSymbol ? `Update ${editingSymbol}` : 'Track a new holding'}
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleSubmitPosition}>
                <div>
                  <label htmlFor="portfolio-symbol" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Symbol
                  </label>
                  <input
                    id="portfolio-symbol"
                    type="text"
                    value={portfolioForm.symbol}
                    onChange={(event) =>
                      setPortfolioForm((current) => ({
                        ...current,
                        symbol: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="AAPL"
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="portfolio-shares" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Shares
                    </label>
                    <input
                      id="portfolio-shares"
                      type="number"
                      min="0"
                      step="any"
                      value={portfolioForm.shares}
                      onChange={(event) =>
                        setPortfolioForm((current) => ({
                          ...current,
                          shares: event.target.value,
                        }))
                      }
                      placeholder="10"
                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="portfolio-cost" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Cost Basis
                    </label>
                    <input
                      id="portfolio-cost"
                      type="number"
                      min="0"
                      step="any"
                      value={portfolioForm.costBasis}
                      onChange={(event) =>
                        setPortfolioForm((current) => ({
                          ...current,
                          costBasis: event.target.value,
                        }))
                      }
                      placeholder="182.50"
                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="portfolio-date" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Date Added
                  </label>
                  <input
                    id="portfolio-date"
                    type="date"
                    value={portfolioForm.dateAdded}
                    onChange={(event) =>
                      setPortfolioForm((current) => ({
                        ...current,
                        dateAdded: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {portfolioError ? <p className="text-sm text-red-400">{portfolioError}</p> : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={addPositionMutation.isPending || updatePositionMutation.isPending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    {editingSymbol ? 'Update Position' : 'Add Position'}
                  </button>

                  {editingSymbol ? (
                    <button
                      type="button"
                      onClick={resetPortfolioForm}
                      className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Positions</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-100">Portfolio Holdings</div>
                </div>
                <div className="text-sm text-zinc-500">{portfolioQuery.data?.positions.length ?? 0} tracked</div>
              </div>

              <div className="mt-4 overflow-x-auto">
                {portfolioQuery.isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-xl bg-zinc-950/70" />
                    ))}
                  </div>
                ) : (portfolioQuery.data?.positions.length ?? 0) > 0 ? (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                      <tr className="border-b border-zinc-800">
                        <th className="pb-3 pr-4 font-medium">Symbol</th>
                        <th className="pb-3 pr-4 font-medium">Shares</th>
                        <th className="pb-3 pr-4 font-medium">Cost</th>
                        <th className="pb-3 pr-4 font-medium">Current</th>
                        <th className="pb-3 pr-4 font-medium">Value</th>
                        <th className="pb-3 pr-4 font-medium">P&amp;L</th>
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(portfolioQuery.data?.positions ?? []).map((position) => {
                        const positive = position.plDollar >= 0
                        return (
                          <tr key={position.symbol} className="border-b border-zinc-800/70">
                            <td className="py-3 pr-4">
                              <button
                                type="button"
                                onClick={() => handleSelectSymbol(position.symbol)}
                                className="text-left transition-colors hover:text-blue-300"
                              >
                                <div className="font-semibold text-zinc-100">{position.symbol}</div>
                                <div className="text-xs text-zinc-500">{position.name}</div>
                              </button>
                            </td>
                            <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtNumber(position.shares, 2)}</td>
                            <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtCurrency(position.costBasis)}</td>
                            <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtCurrency(position.currentPrice)}</td>
                            <td className="py-3 pr-4 tabular-nums text-zinc-100">{fmtCurrency(position.marketValue)}</td>
                            <td className={cn('py-3 pr-4 tabular-nums font-medium', positive ? 'text-green-400' : 'text-red-400')}>
                              <div>{fmtSignedCurrency(position.plDollar)}</div>
                              <div className="text-xs">{fmtPercent(position.plPercent)}</div>
                            </td>
                            <td className="py-3 pr-4 text-zinc-400">{position.dateAdded}</td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditPosition(position)}
                                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                                  aria-label={`Edit ${position.symbol}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePosition(position.symbol)}
                                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
                                  aria-label={`Delete ${position.symbol}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState title="No portfolio positions yet" detail="Add a holding to start tracking market value and performance." />
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
