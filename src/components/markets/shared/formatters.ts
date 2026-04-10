import type { ChartRangeKey, MarketTone } from '@/types/market'

export function fmtPrice(value: number) {
  const abs = Math.abs(value)
  const digits = abs > 0 && abs < 1 ? 4 : 2
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtCurrency(value: number | null | undefined, currency = 'USD') {
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

export function fmtSignedCurrency(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${fmtCurrency(Math.abs(value), currency)}`
}

export function fmtPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function fmtSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function fmtChange(value: number, percent: number, currency = 'USD') {
  return `${fmtSignedCurrency(value, currency)} (${fmtPercent(percent)})`
}

export function fmtCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function timeAgo(unixSec: number) {
  const diff = Math.floor(Date.now() / 1000 - unixSec)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatChartTimestamp(timestamp: number, range: ChartRangeKey) {
  const date = new Date(timestamp * 1000)
  if (range === '1d') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (range === '1w' || range === '1m' || range === '3m') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function formatDate(unixSec: number | null | undefined) {
  if (!unixSec) return '--'
  return new Date(unixSec * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateCell(date: string) {
  if (!date) return '--'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRawNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return value.toFixed(digits)
}

export function getToneClasses(tone: MarketTone) {
  if (tone === 'bullish') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (tone === 'bearish') return 'border-red-500/30 bg-red-500/10 text-red-400'
  return 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
}

export function toneLabel(tone: MarketTone) {
  if (tone === 'bullish') return 'Bullish'
  if (tone === 'bearish') return 'Bearish'
  return 'Neutral'
}

export function getUpsideTone(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'neutral' as const
  if (value > 0) return 'positive' as const
  if (value < 0) return 'negative' as const
  return 'neutral' as const
}

export function getAnalystActionMeta(action: string | null | undefined) {
  const normalized = action?.toLowerCase().trim() ?? ''
  if (normalized.includes('upgrade')) return { label: 'Upgrade', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' }
  if (normalized.includes('downgrade')) return { label: 'Downgrade', className: 'border-red-500/30 bg-red-500/10 text-red-400' }
  if (normalized.includes('init')) return { label: 'Initiated', className: 'border-blue-500/30 bg-blue-500/10 text-blue-400' }
  if (normalized.includes('reiterate') || normalized.includes('maintain')) return { label: 'Maintain', className: 'border-zinc-700 bg-zinc-800/70 text-zinc-400' }
  return { label: action || 'Action', className: 'border-zinc-700 bg-zinc-800/70 text-zinc-400' }
}

export function getAnalystRatingTone(rating: string | null | undefined) {
  const normalized = rating?.toLowerCase().trim() ?? ''
  if (normalized.includes('strong buy') || normalized === 'buy' || normalized.includes('outperform') || normalized.includes('overweight')) return 'positive'
  if (normalized.includes('strong sell') || normalized === 'sell' || normalized.includes('underperform') || normalized.includes('underweight')) return 'negative'
  return 'neutral'
}

export function getAnalystRatingClass(rating: string | null | undefined) {
  const tone = getAnalystRatingTone(rating)
  if (tone === 'positive') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (tone === 'negative') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

export function getAlignmentClass(alignment: 'supportive' | 'mixed' | 'contradictory') {
  if (alignment === 'supportive') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (alignment === 'contradictory') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}
