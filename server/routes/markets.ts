import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
import { getApiKey, readSettings } from '../lib/settings-store.js'
import {
  detectAiProvider,
  aiProviderLabel,
  buildAiPrompt,
  generateAiInsight,
  getCachedAiInsight,
  setCachedAiInsight,
} from '../lib/ai-provider.js'

const router = Router()

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']

const INDEX_META: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'DOW',
  '^RUT': 'Russell 2000',
}

const SECTOR_META: Array<{ symbol: string; name: string }> = [
  { symbol: 'XLC', name: 'Communication Services' },
  { symbol: 'XLY', name: 'Consumer Discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLU', name: 'Utilities' },
]

const GLOBAL_ASSETS: Array<{ symbol: string; name: string }> = [
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'EUR=F', name: 'Euro' },
  { symbol: 'GC=F', name: 'Gold' },
  { symbol: 'SI=F', name: 'Silver' },
  { symbol: 'CL=F', name: 'Crude Oil' },
]

const CHART_RANGE_CONFIG = {
  '1d': { yahooRange: '1d', interval: '5m', includePrePost: true },
  '1w': { yahooRange: '5d', interval: '30m', includePrePost: false },
  '1m': { yahooRange: '1mo', interval: '1d', includePrePost: false },
  '3m': { yahooRange: '3mo', interval: '1d', includePrePost: false },
  '6m': { yahooRange: '6mo', interval: '1d', includePrePost: false },
  '1y': { yahooRange: '1y', interval: '1wk', includePrePost: false },
  '5y': { yahooRange: '5y', interval: '1mo', includePrePost: false },
} as const

type ChartRangeKey = keyof typeof CHART_RANGE_CONFIG
type HistoricalInterval = '1d' | '1wk' | '1mo'
type MarketTone = 'bullish' | 'neutral' | 'bearish'

interface WatchlistEntry {
  symbol: string
}

interface PortfolioPositionEntry {
  symbol: string
  shares: number
  costBasis: number
  dateAdded: string
}

interface HistoricalPoint {
  timestamp: number
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  adjClose: number | null
  midpoint: number | null
  rangePercent: number | null
  changePercent: number | null
  volume: number | null
}

interface HorizonAnalysis {
  key: 'day' | 'week' | 'month' | 'quarter' | 'sixMonth'
  label: string
  tone: MarketTone
  conviction: 'low' | 'moderate' | 'high'
  confidenceScore: number
  analystAlignment: 'supportive' | 'mixed' | 'contradictory'
  priceChangePercent: number
  volatilityPercent: number
  volumeTrendPercent: number
  support: number | null
  resistance: number | null
  streetView: string
  aiView: string
  drivers: string[]
  risks: string[]
  scoreBreakdown: {
    priceTrend: number
    volumeTrend: number
    headlineTone: number
    analystTarget: number
    analystRating: number
    analystActions: number
    volatilityPenalty: number
    dataDepthAdjustment: number
    analystAlignmentAdjustment: number
    rawComposite: number
  }
}

const POSITIVE_HEADLINE_KEYWORDS = [
  'beat',
  'beats',
  'bullish',
  'buy',
  'gain',
  'gains',
  'growth',
  'higher',
  'outperform',
  'raised',
  'rally',
  'record',
  'strong',
  'surge',
  'upgrade',
]

const NEGATIVE_HEADLINE_KEYWORDS = [
  'bearish',
  'cuts',
  'cut',
  'decline',
  'delay',
  'downgrade',
  'drop',
  'drops',
  'fall',
  'falls',
  'lawsuit',
  'lower',
  'miss',
  'misses',
  'risk',
  'slump',
  'weak',
  'warning',
]

const ANALYST_HEADLINE_KEYWORDS = [
  'analyst',
  'analysts',
  'buy rating',
  'hold rating',
  'price target',
  'price targets',
  'raised target',
  'downgrade',
  'upgrade',
  'overweight',
  'underweight',
  'outperform',
  'underperform',
  'initiated',
]

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeChartRange(range?: string): ChartRangeKey {
  const input = range?.toLowerCase().trim()
  switch (input) {
    case '1d':
      return '1d'
    case '1w':
    case '5d':
      return '1w'
    case '1m':
    case '1mo':
      return '1m'
    case '3m':
    case '3mo':
      return '3m'
    case '6m':
    case '6mo':
      return '6m'
    case '1y':
      return '1y'
    case '5y':
      return '5y'
    default:
      return '1d'
  }
}

function normalizeHistoricalInterval(interval?: string): HistoricalInterval {
  const value = interval?.toLowerCase().trim()
  if (value === '1wk' || value === '1w' || value === '1week') return '1wk'
  if (value === '1mo' || value === '1m' || value === '1month') return '1mo'
  return '1d'
}

function parseDateBoundary(input: string, endOfDay = false) {
  if (!input || Number.isNaN(Date.parse(input))) return null
  const date = new Date(`${input}T${endOfDay ? '23:59:59' : '00:00:00'}Z`)
  const timestamp = Math.floor(date.getTime() / 1000)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatIsoDate(unixSec: number) {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: YF_HEADERS })
  if (!res.ok) {
    throw new Error(`Yahoo Finance error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

function getAnalystFeedApiKey() {
  return getApiKey('fmp') ?? ''
}

function getTwelveDataApiKey() {
  return getApiKey('twelvedata') ?? ''
}

function buildFmpUrl(path: string, params: Record<string, string | number | undefined>, apiKey: string) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value))
    }
  }
  searchParams.set('apikey', apiKey)
  return `https://financialmodelingprep.com${path}?${searchParams.toString()}`
}

function buildTwelveDataUrl(path: string, params: Record<string, string | number | undefined>, apiKey: string) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value))
    }
  }
  searchParams.set('apikey', apiKey)
  return `https://api.twelvedata.com${path}?${searchParams.toString()}`
}

async function fetchFmpJson<T>(path: string, params: Record<string, string | number | undefined>, apiKey: string): Promise<T> {
  const res = await fetch(buildFmpUrl(path, params, apiKey))
  const text = await res.text()
  if (!res.ok) {
    const error = new Error(`FMP error: ${res.status}`)
    ;(error as Error & { status?: number; body?: string }).status = res.status
    ;(error as Error & { status?: number; body?: string }).body = text
    throw error
  }
  return JSON.parse(text) as T
}

async function fetchFmpSafe<T>(path: string, params: Record<string, string | number | undefined>, apiKey: string) {
  try {
    return {
      data: await fetchFmpJson<T>(path, params, apiKey),
      error: null,
    }
  } catch (error) {
    const err = error as Error & { status?: number; body?: string }
    return {
      data: null,
      error: {
        status: err.status ?? 500,
        body: err.body ?? err.message,
      },
    }
  }
}

async function fetchTwelveDataJson<T>(path: string, params: Record<string, string | number | undefined>, apiKey: string): Promise<T> {
  const res = await fetch(buildTwelveDataUrl(path, params, apiKey))
  const text = await res.text()
  if (!res.ok) {
    const error = new Error(`Twelve Data error: ${res.status}`)
    ;(error as Error & { status?: number; body?: string }).status = res.status
    ;(error as Error & { status?: number; body?: string }).body = text
    throw error
  }
  return JSON.parse(text) as T
}

async function fetchTwelveDataSafe<T>(path: string, params: Record<string, string | number | undefined>, apiKey: string) {
  try {
    return {
      data: await fetchTwelveDataJson<T>(path, params, apiKey),
      error: null,
    }
  } catch (error) {
    const err = error as Error & { status?: number; body?: string }
    return {
      data: null,
      error: {
        status: err.status ?? 500,
        body: err.body ?? err.message,
      },
    }
  }
}

function getEmbeddedProviderError(payload: any) {
  if (payload?.status === 'error' || (typeof payload?.code === 'number' && payload.code >= 400)) {
    return {
      status: typeof payload?.code === 'number' ? payload.code : 400,
      body: typeof payload?.message === 'string' ? payload.message : 'Provider error',
    }
  }
  return null
}

async function fetchFinanceSearch(query: string, newsCount: number, quotesCount: number) {
  const url =
    'https://query1.finance.yahoo.com/v1/finance/search?' +
    `q=${encodeURIComponent(query)}` +
    `&newsCount=${newsCount}` +
    `&quotesCount=${quotesCount}` +
    '&enableFuzzyQuery=false&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=false'
  return fetchJson<any>(url)
}

async function fetchChart(symbol: string, range: string = '1d', interval?: string) {
  const rangeKey = normalizeChartRange(range)
  const config = CHART_RANGE_CONFIG[rangeKey]
  const resolvedInterval = interval ?? config.interval
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${config.yahooRange}&interval=${resolvedInterval}&includePrePost=${String(config.includePrePost)}` +
    '&events=div,splits'
  return fetchJson<any>(url)
}

async function fetchHistoricalChart(symbol: string, startDate: string, endDate: string, interval: HistoricalInterval) {
  const period1 = parseDateBoundary(startDate)
  const period2 = parseDateBoundary(endDate, true)
  if (period1 === null || period2 === null || period2 <= period1) {
    throw new Error('Invalid historical date range')
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false&events=div,splits`
  return fetchJson<any>(url)
}

async function fetchScreenerQuotes(scrId: string, count: number) {
  const url =
    'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved' +
    `?count=${count}&scrIds=${encodeURIComponent(scrId)}`
  const data = await fetchJson<any>(url)
  return (data?.finance?.result?.[0]?.quotes ?? []) as any[]
}

async function fetchTimeseriesValue(symbol: string, type: string): Promise<number | null> {
  const now = Math.floor(Date.now() / 1000)
  const url =
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}&period1=493590046&period2=${now}`

  try {
    const data = await fetchJson<any>(url)
    const result = data?.timeseries?.result?.[0]
    const values = Array.isArray(result?.[type]) ? result[type] : []
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const raw = toNumber(values[index]?.reportedValue?.raw)
      if (raw !== null) {
        return raw
      }
    }
    return null
  } catch {
    return null
  }
}

function getChartResult(data: any, symbol: string) {
  const result = data?.chart?.result?.[0]
  if (!result) {
    throw new Error(`No chart data for ${symbol}`)
  }
  return result
}

function getLastNumber(values: Array<number | null | undefined>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = toNumber(values[index])
    if (value !== null) {
      return value
    }
  }
  return null
}

function buildChartPoints(result: any) {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const opens = Array.isArray(quote?.open) ? quote.open : []
  const highs = Array.isArray(quote?.high) ? quote.high : []
  const lows = Array.isArray(quote?.low) ? quote.low : []
  const closes = Array.isArray(quote?.close) ? quote.close : []
  const volumes = Array.isArray(quote?.volume) ? quote.volume : []

  return timestamps
    .map((timestamp: number, index: number) => {
      const close = toNumber(closes[index])
      if (close === null) {
        return null
      }

      return {
        timestamp,
        open: toNumber(opens[index]),
        high: toNumber(highs[index]),
        low: toNumber(lows[index]),
        close,
        volume: toNumber(volumes[index]),
      }
    })
    .filter((point: { timestamp: number; open: number | null; high: number | null; low: number | null; close: number; volume: number | null } | null): point is {
      timestamp: number
      open: number | null
      high: number | null
      low: number | null
      close: number
      volume: number | null
    } => point !== null)
}

function buildHistoricalPoints(result: any): HistoricalPoint[] {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const opens = Array.isArray(quote?.open) ? quote.open : []
  const highs = Array.isArray(quote?.high) ? quote.high : []
  const lows = Array.isArray(quote?.low) ? quote.low : []
  const closes = Array.isArray(quote?.close) ? quote.close : []
  const adjCloses = Array.isArray(result?.indicators?.adjclose?.[0]?.adjclose)
    ? result.indicators.adjclose[0].adjclose
    : []
  const volumes = Array.isArray(quote?.volume) ? quote.volume : []

  return timestamps.map((timestamp: number, index: number) => {
    const open = toNumber(opens[index])
    const high = toNumber(highs[index])
    const low = toNumber(lows[index])
    const close = toNumber(closes[index])
    const adjClose = toNumber(adjCloses[index]) ?? close
    const midpoint = high !== null && low !== null ? (high + low) / 2 : close
    const rangePercent =
      open !== null && open !== 0 && high !== null && low !== null ? ((high - low) / open) * 100 : null
    const changePercent =
      open !== null && open !== 0 && close !== null ? ((close - open) / open) * 100 : null

    return {
      timestamp,
      date: formatIsoDate(timestamp),
      open,
      high,
      low,
      close,
      adjClose,
      midpoint,
      rangePercent,
      changePercent,
      volume: toNumber(volumes[index]),
    }
  })
}

function extractQuoteFromChart(data: any, symbol: string, fallbackName: string) {
  const result = getChartResult(data, symbol)
  const meta = result?.meta ?? {}
  const points = buildChartPoints(result)
  const price = toNumber(meta.regularMarketPrice) ?? points[points.length - 1]?.close ?? 0
  const previousClose = toNumber(meta.chartPreviousClose) ?? toNumber(meta.previousClose) ?? price
  const change = price - previousClose
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? fallbackName,
    price,
    change,
    changePercent,
    marketState: meta.marketState ?? 'CLOSED',
    sparkline: points.map((point) => point.close),
    meta,
  }
}

function buildChartResponse(data: any, symbol: string, range: ChartRangeKey, interval?: string) {
  const result = getChartResult(data, symbol)
  const meta = result?.meta ?? {}
  const points = buildChartPoints(result)
  const price = toNumber(meta.regularMarketPrice) ?? points[points.length - 1]?.close ?? 0
  const previousClose = toNumber(meta.chartPreviousClose) ?? toNumber(meta.previousClose) ?? price
  const change = price - previousClose
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    currency: meta.currency ?? 'USD',
    exchangeName: meta.fullExchangeName ?? meta.exchangeName ?? '',
    marketState: meta.marketState ?? 'CLOSED',
    regularMarketTime: toNumber(meta.regularMarketTime),
    price,
    previousClose,
    change,
    changePercent,
    range,
    interval: interval ?? CHART_RANGE_CONFIG[range].interval,
    dayHigh: toNumber(meta.regularMarketDayHigh),
    dayLow: toNumber(meta.regularMarketDayLow),
    fiftyTwoWeekHigh: toNumber(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: toNumber(meta.fiftyTwoWeekLow),
    points,
  }
}

function formatVolume(volume: number | null | undefined): string {
  if (!volume) return '--'
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(1)}B`
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}K`
  return String(Math.round(volume))
}

function formatMarketCap(marketCap: number | null | undefined): string {
  if (!marketCap) return '--'
  if (marketCap >= 1_000_000_000_000) return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`
  if (marketCap >= 1_000_000_000) return `$${(marketCap / 1_000_000_000).toFixed(1)}B`
  if (marketCap >= 1_000_000) return `$${(marketCap / 1_000_000).toFixed(1)}M`
  return `$${Math.round(marketCap)}`
}

function average(values: Array<number | null | undefined>) {
  const valid = values.map((value) => toNumber(value)).filter((value): value is number => value !== null)
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function sumDividendEvents(data: any) {
  const dividends = Object.values(data?.chart?.result?.[0]?.events?.dividends ?? {}) as Array<{ amount?: number }>
  return dividends.reduce((sum, dividend) => sum + (toNumber(dividend?.amount) ?? 0), 0)
}

async function buildDetailedQuote(symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol)

  const [intradayChart, yearlyChart, quarterlyChart, dilutedEps, basicEps, dilutedShares, basicShares, searchData] =
    await Promise.all([
      fetchChart(normalizedSymbol, '1d'),
      fetchChart(normalizedSymbol, '1y'),
      fetchChart(normalizedSymbol, '3m', '1d'),
      fetchTimeseriesValue(normalizedSymbol, 'trailingDilutedEPS'),
      fetchTimeseriesValue(normalizedSymbol, 'trailingBasicEPS'),
      fetchTimeseriesValue(normalizedSymbol, 'quarterlyDilutedAverageShares'),
      fetchTimeseriesValue(normalizedSymbol, 'quarterlyBasicAverageShares'),
      fetchFinanceSearch(normalizedSymbol, 0, 1).catch(() => null),
    ])

  const quote = extractQuoteFromChart(intradayChart, normalizedSymbol, normalizedSymbol)
  const price = quote.price
  const eps = dilutedEps ?? basicEps
  const shares = dilutedShares ?? basicShares
  const averageVolume = average(
    buildChartPoints(getChartResult(quarterlyChart, normalizedSymbol)).map((point) => point.volume),
  )
  const trailingAnnualDividend = sumDividendEvents(yearlyChart)
  const dividendYield = price > 0 && trailingAnnualDividend > 0 ? (trailingAnnualDividend / price) * 100 : null
  const peRatio = eps !== null && eps !== 0 ? price / eps : null
  const marketCap = shares !== null ? price * shares : null
  const profile = searchData?.quotes?.[0] ?? null

  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    marketState: quote.marketState,
    exchangeName: quote.meta.fullExchangeName ?? quote.meta.exchangeName ?? '',
    currency: quote.meta.currency ?? 'USD',
    regularMarketTime: toNumber(quote.meta.regularMarketTime),
    sector: typeof profile?.sectorDisp === 'string' ? profile.sectorDisp : null,
    industry: typeof profile?.industryDisp === 'string' ? profile.industryDisp : null,
    stats: {
      open: toNumber(quote.meta.regularMarketOpen),
      previousClose: toNumber(quote.meta.chartPreviousClose) ?? toNumber(quote.meta.previousClose),
      dayHigh: toNumber(quote.meta.regularMarketDayHigh),
      dayLow: toNumber(quote.meta.regularMarketDayLow),
      volume: toNumber(quote.meta.regularMarketVolume),
      peRatio,
      fiftyTwoWeekHigh: toNumber(quote.meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: toNumber(quote.meta.fiftyTwoWeekLow),
      eps,
      dividendYield,
      avgVolume: averageVolume,
      marketCap,
    },
  }
}

function scoreHeadline(title: string) {
  const lower = title.toLowerCase()
  let score = 0

  for (const keyword of POSITIVE_HEADLINE_KEYWORDS) {
    if (lower.includes(keyword)) score += 1
  }

  for (const keyword of NEGATIVE_HEADLINE_KEYWORDS) {
    if (lower.includes(keyword)) score -= 1
  }

  return score
}

function hasAnalystLanguage(title: string) {
  const lower = title.toLowerCase()
  return ANALYST_HEADLINE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function toneFromHeadlineScore(score: number): MarketTone {
  if (score > 0) return 'bullish'
  if (score < 0) return 'bearish'
  return 'neutral'
}

function formatSignedPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

async function fetchRelevantNews(query: string, count: number) {
  const data = await fetchFinanceSearch(query, count, 1)
  return (data?.news ?? []).map((item: any) => {
    const title = item.title ?? 'Untitled'
    return {
      id: item.uuid ?? String(Math.random()),
      title,
      source: item.publisher ?? 'Yahoo Finance',
      url: item.link ?? '#',
      publishedAt: item.providerPublishTime ?? Date.now() / 1000,
      sentiment: toneFromHeadlineScore(scoreHeadline(title)),
    }
  })
}

function normalizeHeadlineText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s&]/g, ' ')
}

function normalizeHeadlineKey(value: string) {
  return normalizeHeadlineText(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
    .join(' ')
}

function extractNameTokens(name: string | null | undefined) {
  if (!name) return []
  const stopWords = new Set([
    'inc',
    'incorporated',
    'corp',
    'corporation',
    'company',
    'co',
    'group',
    'holdings',
    'holdings',
    'etf',
    'fund',
    'trust',
    'class',
    'shares',
    'stock',
    'plc',
    'ltd',
  ])

  return normalizeHeadlineText(name)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

function getHeadlineRelevanceScore(item: any, symbol: string, name: string | null | undefined) {
  const relatedTickers = Array.isArray(item?.relatedTickers) ? item.relatedTickers : []
  let score = 0

  if (relatedTickers.some((ticker) => typeof ticker === 'string' && ticker.toUpperCase() === symbol)) {
    score += 5
  }

  const title = typeof item?.title === 'string' ? normalizeHeadlineText(item.title) : ''
  if (title.includes(symbol.toLowerCase())) score += 4

  const tokens = extractNameTokens(name)
  if (tokens.length > 0) {
    score += tokens.reduce((count, token) => count + (title.includes(token) ? 1 : 0), 0)
  }

  if (relatedTickers.length > 6) score -= 1
  if (title.includes('stock market today') || title.includes('live coverage')) score -= 1

  return score
}

function buildHeadlineTags(item: any, symbol: string, name: string | null | undefined) {
  const tags: string[] = []
  const relatedTickers = Array.isArray(item?.relatedTickers) ? item.relatedTickers : []
  const title = typeof item?.title === 'string' ? normalizeHeadlineText(item.title) : ''
  const tokens = extractNameTokens(name)

  if (relatedTickers.some((ticker) => typeof ticker === 'string' && ticker.toUpperCase() === symbol)) {
    tags.push('Direct Ticker')
  }
  if (tokens.some((token) => title.includes(token))) {
    tags.push('Name Match')
  }
  if (hasAnalystLanguage(item?.title ?? '')) {
    tags.push('Analyst')
  }
  if (scoreHeadline(item?.title ?? '') > 0) {
    tags.push('Positive Tone')
  } else if (scoreHeadline(item?.title ?? '') < 0) {
    tags.push('Negative Tone')
  }

  return tags.slice(0, 3)
}

async function fetchSymbolNews(symbol: string, fallbackName?: string) {
  const normalizedSymbol = normalizeSymbol(symbol)
  const seed = await fetchFinanceSearch(normalizedSymbol, 0, 5).catch(() => null)
  const matchedQuote =
    seed?.quotes?.find((quote: any) => typeof quote?.symbol === 'string' && quote.symbol.toUpperCase() === normalizedSymbol) ??
    seed?.quotes?.[0] ??
    null
  const resolvedName =
    (typeof matchedQuote?.longname === 'string' && matchedQuote.longname) ||
    (typeof matchedQuote?.shortname === 'string' && matchedQuote.shortname) ||
    fallbackName ||
    normalizedSymbol

  const data = await fetchFinanceSearch(resolvedName, 12, 5)
  const scored = (data?.news ?? [])
    .map((item: any) => ({
      item,
      score: getHeadlineRelevanceScore(item, normalizedSymbol, resolvedName),
    }))
    .filter((entry: { score: number }) => entry.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
  const seen = new Set<string>()

  return scored
    .filter(({ item }: { item: any }) => {
      const key = normalizeHeadlineKey(item?.title ?? '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 10)
    .map(({ item, score }: { item: any; score: number }) => {
    const title = item.title ?? 'Untitled'
    return {
      id: item.uuid ?? String(Math.random()),
      title,
      source: item.publisher ?? 'Yahoo Finance',
      url: item.link ?? '#',
      publishedAt: item.providerPublishTime ?? Date.now() / 1000,
      sentiment: toneFromHeadlineScore(scoreHeadline(title)),
      tags: buildHeadlineTags(item, normalizedSymbol, resolvedName),
      relevanceScore: score,
    }
  })
}

function buildHistorySummary(points: HistoricalPoint[]) {
  const validClosePoints = points.filter((point) => point.close !== null)
  const validHighs = points.map((point) => point.high).filter((value): value is number => value !== null)
  const validLows = points.map((point) => point.low).filter((value): value is number => value !== null)
  const validVolumes = points.map((point) => point.volume).filter((value): value is number => value !== null)
  const firstClose = validClosePoints[0]?.close ?? null
  const lastClose = validClosePoints[validClosePoints.length - 1]?.close ?? null
  const absoluteChange = firstClose !== null && lastClose !== null ? lastClose - firstClose : null
  const percentChange =
    firstClose !== null && firstClose !== 0 && absoluteChange !== null ? (absoluteChange / firstClose) * 100 : null

  return {
    rows: points.length,
    highestHigh: validHighs.length > 0 ? Math.max(...validHighs) : null,
    lowestLow: validLows.length > 0 ? Math.min(...validLows) : null,
    latestClose: lastClose,
    latestAdjClose: points[points.length - 1]?.adjClose ?? null,
    averageVolume: average(validVolumes),
    absoluteChange,
    percentChange,
  }
}

function describeStreetView(
  label: string,
  tone: MarketTone,
  positive: number,
  negative: number,
  neutral: number,
  analystMentions: number,
  analystContext?: {
    rating: string | null
    upsidePercent: number | null
    upgrades: number
    downgrades: number
  },
) {
  const total = positive + negative + neutral
  const toneText =
    tone === 'bullish'
      ? 'headline tone is leaning constructive'
      : tone === 'bearish'
        ? 'headline tone is leaning cautious'
        : 'headline tone is mixed'

  if (total === 0) {
    return `Street view (${label}) is thin right now because there are no fresh headlines to anchor consensus.`
  }

  const analystText =
    analystMentions > 0
      ? `${analystMentions} headline${analystMentions === 1 ? '' : 's'} reference analyst actions or targets`
      : 'recent coverage is mostly narrative rather than analyst-call heavy'

  const consensusText =
    analystContext && (analystContext.rating !== null || analystContext.upsidePercent !== null)
      ? ` Dedicated analyst consensus is ${analystContext?.rating ?? 'unrated'} with ${formatSignedPercent(analystContext?.upsidePercent ?? 0)} implied upside/downside, while upgrades vs downgrades are ${analystContext?.upgrades ?? 0} to ${analystContext?.downgrades ?? 0}.`
      : ''

  return `Street view (${label}): ${toneText} with ${positive} positive, ${negative} negative, and ${neutral} neutral headlines; ${analystText}.${consensusText}`
}

function describeFallbackAiView(
  label: string,
  tone: MarketTone,
  priceChangePercent: number,
  volatilityPercent: number,
  volumeTrendPercent: number,
  support: number | null,
  resistance: number | null,
  analystContext?: {
    rating: string | null
    upsidePercent: number | null
    targetConsensus: number | null
  },
) {
  const structureText =
    tone === 'bullish'
      ? 'momentum is still pressing upward'
      : tone === 'bearish'
        ? 'sellers still control the tape'
        : 'price is still looking for direction'

  const volumeText =
    volumeTrendPercent > 10
      ? 'participation is expanding'
      : volumeTrendPercent < -10
        ? 'participation is fading'
        : 'volume is close to baseline'

  const levelText =
    support !== null && resistance !== null
      ? `Support is near ${support.toFixed(2)} and resistance is near ${resistance.toFixed(2)}.`
      : 'Support and resistance are still forming.'

  const analystOverlay =
    analystContext && (analystContext.rating !== null || analystContext.targetConsensus !== null)
      ? ` Street consensus points to a ${analystContext?.rating ?? 'mixed'} rating with a target near ${analystContext?.targetConsensus?.toFixed(2) ?? '--'}.`
      : ''

  return `MehAI (${label}): ${structureText}; return is ${formatSignedPercent(priceChangePercent)}, average swing is ${volatilityPercent.toFixed(2)}%, and ${volumeText}. ${levelText}${analystOverlay}`
}

function getAnalystAlignment(
  tone: MarketTone,
  analystContext?: {
    rating: string | null
    upsidePercent: number | null
  },
): 'supportive' | 'mixed' | 'contradictory' {
  if (!analystContext || (analystContext.rating === null && analystContext.upsidePercent === null)) return 'mixed'

  const rating = analystContext.rating?.toLowerCase() ?? ''
  const upside = analystContext.upsidePercent ?? 0
  const analystTone: MarketTone =
    rating.includes('buy') || upside > 5 ? 'bullish' : rating.includes('sell') || upside < -5 ? 'bearish' : 'neutral'

  if (analystTone === 'neutral' || tone === 'neutral') return 'mixed'
  return analystTone === tone ? 'supportive' : 'contradictory'
}

function buildHorizonDrivers(
  priceChangePercent: number,
  volatilityPercent: number,
  volumeTrendPercent: number,
  analystContext?: {
    rating: string | null
    upsidePercent: number | null
    targetConsensus: number | null
    upgrades: number
    downgrades: number
  },
) {
  const drivers: string[] = []

  if (priceChangePercent >= 2) drivers.push(`Price trend is positive at ${formatSignedPercent(priceChangePercent)}`)
  else if (priceChangePercent <= -2) drivers.push(`Price trend is negative at ${formatSignedPercent(priceChangePercent)}`)
  else drivers.push(`Price trend is mostly flat at ${formatSignedPercent(priceChangePercent)}`)

  if (volumeTrendPercent >= 10) drivers.push(`Volume is expanding by ${formatSignedPercent(volumeTrendPercent)}`)
  else if (volumeTrendPercent <= -10) drivers.push(`Volume is fading by ${formatSignedPercent(volumeTrendPercent)}`)
  else drivers.push('Volume is near baseline')

  if (analystContext?.rating) drivers.push(`Street consensus rating is ${analystContext.rating}`)
  if (analystContext?.upsidePercent !== null && analystContext?.upsidePercent !== undefined) {
    drivers.push(`Analyst target implies ${formatSignedPercent(analystContext.upsidePercent)} upside/downside`)
  }
  if ((analystContext?.upgrades ?? 0) > 0 || (analystContext?.downgrades ?? 0) > 0) {
    drivers.push(`Recent analyst actions: ${analystContext?.upgrades ?? 0} upgrades vs ${analystContext?.downgrades ?? 0} downgrades`)
  }
  if (volatilityPercent >= 3.5) drivers.push(`Average swing is elevated at ${volatilityPercent.toFixed(2)}%`)

  return drivers.slice(0, 4)
}

function buildHorizonRisks(
  volatilityPercent: number,
  analystAlignment: 'supportive' | 'mixed' | 'contradictory',
  support: number | null,
  resistance: number | null,
  analystContext?: {
    upgrades: number
    downgrades: number
  },
) {
  const risks: string[] = []

  if (volatilityPercent >= 4) risks.push('Volatility is elevated, so signal reliability is lower')
  if (analystAlignment === 'contradictory') risks.push('Analyst consensus conflicts with current price structure')
  if ((analystContext?.downgrades ?? 0) > (analystContext?.upgrades ?? 0)) risks.push('Recent analyst actions skew negative')
  if (support !== null && resistance !== null) risks.push(`Price is boxed between ${support.toFixed(2)} support and ${resistance.toFixed(2)} resistance`)
  if (risks.length === 0) risks.push('No dominant risk flag is standing out beyond normal market noise')

  return risks.slice(0, 3)
}

function buildHorizonAnalysis(
  key: HorizonAnalysis['key'],
  label: string,
  points: HistoricalPoint[],
  baselinePoints: HistoricalPoint[],
  signals: { positive: number; negative: number; neutral: number; analystMentions: number },
  analystContext?: {
    rating: string | null
    upsidePercent: number | null
    targetConsensus: number | null
    upgrades: number
    downgrades: number
  },
): HorizonAnalysis {
  const valid = points.filter((point) => point.close !== null)
  const firstClose = valid[0]?.close ?? 0
  const lastClose = valid[valid.length - 1]?.close ?? 0
  const priceChangePercent = firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0
  const volatilityPercent =
    average(points.map((point) => point.rangePercent).filter((value): value is number => value !== null)) ?? 0
  const supportCandidates = points.map((point) => point.low).filter((value): value is number => value !== null)
  const resistanceCandidates = points.map((point) => point.high).filter((value): value is number => value !== null)
  const support = supportCandidates.length > 0 ? Math.min(...supportCandidates) : null
  const resistance = resistanceCandidates.length > 0 ? Math.max(...resistanceCandidates) : null
  const recentVolume =
    average(points.map((point) => point.volume).filter((value): value is number => value !== null)) ?? 0
  const baselineVolume =
    average(baselinePoints.map((point) => point.volume).filter((value): value is number => value !== null)) ?? recentVolume
  const volumeTrendPercent =
    baselineVolume > 0 ? ((recentVolume - baselineVolume) / baselineVolume) * 100 : 0
  const newsBias =
    signals.positive + signals.negative + signals.neutral > 0
      ? (signals.positive - signals.negative) / (signals.positive + signals.negative + signals.neutral)
      : 0
  const priceTrendScore = priceChangePercent / 6
  const volumeTrendScore = volumeTrendPercent / 35
  const headlineToneScore = newsBias * 2
  const analystTargetScore =
    analystContext?.upsidePercent !== null && analystContext?.upsidePercent !== undefined
      ? analystContext.upsidePercent / 18
      : 0
  const analystRatingScore =
    analystContext?.rating?.toLowerCase().includes('buy')
      ? 0.55
      : analystContext?.rating?.toLowerCase().includes('sell')
        ? -0.55
        : 0
  const analystActionScore =
    analystContext ? (analystContext.upgrades - analystContext.downgrades) / 10 : 0
  const volatilityPenalty = volatilityPercent / 10
  const rawComposite =
    priceTrendScore +
    volumeTrendScore +
    headlineToneScore +
    analystTargetScore +
    analystRatingScore +
    analystActionScore -
    volatilityPenalty
  const compositeScore = rawComposite
  const tone: MarketTone = compositeScore > 0.45 ? 'bullish' : compositeScore < -0.45 ? 'bearish' : 'neutral'
  const conviction =
    Math.abs(compositeScore) > 1.35 ? 'high' : Math.abs(compositeScore) > 0.7 ? 'moderate' : 'low'
  const analystAlignment = getAnalystAlignment(tone, analystContext)
  const dataDepthAdjustment = valid.length >= 20 ? 6 : valid.length >= 5 ? 2 : -4
  const analystAlignmentAdjustment = analystAlignment === 'supportive' ? 7 : analystAlignment === 'contradictory' ? -8 : 0
  const confidenceScore = Math.max(
    35,
    Math.min(
      94,
      Math.round(
        52 +
          Math.min(Math.abs(rawComposite) * 14, 22) +
          dataDepthAdjustment +
          analystAlignmentAdjustment -
          Math.min(volatilityPercent * 1.8, 12),
      ),
    ),
  )
  const drivers = buildHorizonDrivers(priceChangePercent, volatilityPercent, volumeTrendPercent, analystContext)
  const risks = buildHorizonRisks(volatilityPercent, analystAlignment, support, resistance, analystContext)

  return {
    key,
    label,
    tone,
    conviction,
    confidenceScore,
    analystAlignment,
    priceChangePercent,
    volatilityPercent,
    volumeTrendPercent,
    support,
    resistance,
    streetView: describeStreetView(
      label,
      tone,
      signals.positive,
      signals.negative,
      signals.neutral,
      signals.analystMentions,
      analystContext,
    ),
    aiView: describeFallbackAiView(
      label,
      tone,
      priceChangePercent,
      volatilityPercent,
      volumeTrendPercent,
      support,
      resistance,
      analystContext,
    ),
    drivers,
    risks,
    scoreBreakdown: {
      priceTrend: Number(priceTrendScore.toFixed(3)),
      volumeTrend: Number(volumeTrendScore.toFixed(3)),
      headlineTone: Number(headlineToneScore.toFixed(3)),
      analystTarget: Number(analystTargetScore.toFixed(3)),
      analystRating: Number(analystRatingScore.toFixed(3)),
      analystActions: Number(analystActionScore.toFixed(3)),
      volatilityPenalty: Number((-volatilityPenalty).toFixed(3)),
      dataDepthAdjustment,
      analystAlignmentAdjustment,
      rawComposite: Number(rawComposite.toFixed(3)),
    },
  }
}

async function buildMarketInsight(symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol)
  const [intradayChart, sixMonthChart, searchData] = await Promise.all([
    fetchChart(normalizedSymbol, '1d'),
    fetchChart(normalizedSymbol, '6m', '1d'),
    fetchFinanceSearch(normalizedSymbol, 0, 1).catch(() => null),
  ])

  const intradayPoints = buildHistoricalPoints(getChartResult(intradayChart, normalizedSymbol))
  const sixMonthPoints = buildHistoricalPoints(getChartResult(sixMonthChart, normalizedSymbol)).filter(
    (point) => point.close !== null,
  )
  const profile = searchData?.quotes?.[0] ?? null
  const currentPrice = extractQuoteFromChart(intradayChart, normalizedSymbol, normalizedSymbol).price
  const headlines = await fetchSymbolNews(
    normalizedSymbol,
    (typeof profile?.longname === 'string' && profile.longname) || (typeof profile?.shortname === 'string' && profile.shortname) || normalizedSymbol,
  ).catch(() => [])
  const analystFeed = await buildAnalystFeed(normalizedSymbol, currentPrice).catch(() => null)
  const analystContext = analystFeed?.configured
    ? {
        rating: analystFeed.gradesConsensus?.rating ?? null,
        upsidePercent: analystFeed.priceTargetConsensus?.upsidePercent ?? null,
        targetConsensus: analystFeed.priceTargetConsensus?.consensus ?? null,
        upgrades: analystFeed.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('upgrade')).length,
        downgrades: analystFeed.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('downgrade')).length,
        maintains: analystFeed.latestActions.filter((item) => {
          const action = (item.action ?? '').toLowerCase()
          return action.includes('maintain') || action.includes('reiterate')
        }).length,
      }
    : {
        rating: null,
        upsidePercent: null,
        targetConsensus: null,
        upgrades: 0,
        downgrades: 0,
        maintains: 0,
      }

  const signals = headlines.reduce(
    (acc, item) => {
      if (item.sentiment === 'bullish') acc.positive += 1
      else if (item.sentiment === 'bearish') acc.negative += 1
      else acc.neutral += 1
      if (hasAnalystLanguage(item.title)) acc.analystMentions += 1
      return acc
    },
    { positive: 0, negative: 0, neutral: 0, analystMentions: 0 },
  )

  const horizons: HorizonAnalysis[] = [
    buildHorizonAnalysis('day', 'Today', intradayPoints, sixMonthPoints.slice(-20), signals, analystContext),
    buildHorizonAnalysis('week', '1 Week', sixMonthPoints.slice(-5), sixMonthPoints.slice(-10, -5), signals, analystContext),
    buildHorizonAnalysis('month', '1 Month', sixMonthPoints.slice(-21), sixMonthPoints.slice(-42, -21), signals, analystContext),
    buildHorizonAnalysis('quarter', '3 Months', sixMonthPoints.slice(-63), sixMonthPoints.slice(-126, -63), signals, analystContext),
    buildHorizonAnalysis('sixMonth', '6 Months', sixMonthPoints, sixMonthPoints.slice(0, Math.max(sixMonthPoints.length - 63, 1)), signals, analystContext),
  ]

  const bullishCount = horizons.filter((item) => item.tone === 'bullish').length
  const bearishCount = horizons.filter((item) => item.tone === 'bearish').length
  const overallTone: MarketTone = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral'
  const primarySupport = horizons.find((item) => item.support !== null)?.support ?? null
  const primaryResistance = horizons.find((item) => item.resistance !== null)?.resistance ?? null
  const averageVolume =
    average(sixMonthPoints.map((point) => point.volume).filter((value): value is number => value !== null)) ?? null

  return {
    symbol: normalizedSymbol,
    name:
      (typeof profile?.longname === 'string' && profile.longname) ||
      (typeof profile?.shortname === 'string' && profile.shortname) ||
      extractQuoteFromChart(intradayChart, normalizedSymbol, normalizedSymbol).name,
    generatedAt: Math.floor(Date.now() / 1000),
    overallTone,
    dataFreshness: {
      marketDataTime: extractQuoteFromChart(intradayChart, normalizedSymbol, normalizedSymbol).meta?.regularMarketTime ?? null,
      analystDataTime: analystFeed?.updatedAt ?? null,
      headlineCount: headlines.length,
    },
    streetSummary:
      analystFeed?.configured
        ? `Street consensus is ${analystContext.rating ?? 'mixed'} with ${formatSignedPercent(analystContext.upsidePercent ?? 0)} implied upside/downside to the analyst target, while recent actions show ${analystContext.upgrades} upgrades, ${analystContext.downgrades} downgrades, and ${analystContext.maintains} maintains.`
        : signals.positive + signals.negative + signals.neutral > 0
          ? `Recent public commentary is ${signals.positive > signals.negative ? 'net positive' : signals.negative > signals.positive ? 'net cautious' : 'mixed'}, with ${signals.analystMentions} analyst-linked headlines in the latest feed.`
          : 'Public commentary is light right now, so street consensus is being inferred from price action more than fresh coverage.',
    aiProvider: 'fallback' as const,
    aiProviderLabel: 'MehAI says\u2026',
    aiSummary:
      overallTone === 'bullish'
        ? `Constructive structure is showing across the dominant windows, and the live analyst feed reinforces that with a ${analystContext.rating ?? 'mixed'} Street posture.`
        : overallTone === 'bearish'
          ? `Weak structure is showing across the dominant windows; even with a ${analystContext.rating ?? 'mixed'} Street posture, rallies look more reactive than trend-changing.`
          : `The tape is balanced right now, and the analyst feed is being treated as a secondary input rather than a decisive signal.`,
    methodology: [
      'Street view blends live analyst consensus, recent rating actions, and symbol-specific headline tone.',
      'AI take blends price trend, volatility, support/resistance, volume shift, and analyst alignment.',
      'Confidence rises with stronger signal agreement and falls when volatility is elevated or Street disagrees with price structure.',
    ],
    trustNotes: [
      'Analyst coverage is stronger for large-cap equities than for ETFs or thinly covered symbols.',
      'Headline relevance is filtered by related tickers and company or ETF name matching.',
      'These summaries are directional and explanatory, not guarantees.',
    ],
    signals,
    keyLevels: {
      support: primarySupport,
      resistance: primaryResistance,
      averageVolume,
    },
    analystContext,
    horizons,
    headlines,
  }
}

function pickString(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(source?.[key])
    if (value !== null) return value
  }
  return null
}

function normalizeAnalystAction(raw: any) {
  const priorGrade = pickString(raw, ['previousGrade', 'oldGrade', 'priorGrade', 'fromGrade'])
  const newGrade = pickString(raw, ['newGrade', 'grade', 'toGrade', 'rating'])
  return {
    date: pickString(raw, ['date', 'publishedDate', 'gradingDate']),
    firm: pickString(raw, ['gradingCompany', 'firm', 'analystFirm', 'company']),
    action: pickString(raw, ['action', 'gradingAction', 'ratingAction', 'gradeChange']),
    priorGrade,
    newGrade,
    publisher: pickString(raw, ['publisher', 'newsPublisher', 'source']),
  }
}

function normalizePriceTargetSummary(raw: any, currentPrice: number | null) {
  const consensus =
    pickNumber(raw, ['priceTarget', 'consensusPriceTarget', 'targetConsensus', 'targetMean', 'targetAverage']) ??
    pickNumber(raw, ['targetMeanPrice', 'targetConsensusPrice'])
  const high = pickNumber(raw, ['targetHigh', 'highPriceTarget', 'targetHighPrice'])
  const low = pickNumber(raw, ['targetLow', 'lowPriceTarget', 'targetLowPrice'])
  const median = pickNumber(raw, ['targetMedian', 'medianPriceTarget', 'targetMedianPrice'])
  const analystCount = pickNumber(raw, [
    'analystCount',
    'numberOfAnalysts',
    'numberAnalystOpinions',
    'lastMonthCount',
    'lastQuarterCount',
    'lastYearCount',
    'allTimeCount',
  ])
  const upsidePercent =
    consensus !== null && currentPrice !== null && currentPrice !== 0 ? ((consensus - currentPrice) / currentPrice) * 100 : null

  return {
    consensus,
    high,
    low,
    median,
    analystCount,
    upsidePercent,
  }
}

function normalizeGradesConsensus(raw: any) {
  const strongBuy = pickNumber(raw, ['strongBuy', 'strong_buy', 'ratingStrongBuy'])
  const buy = pickNumber(raw, ['buy', 'ratingBuy'])
  const hold = pickNumber(raw, ['hold', 'ratingHold'])
  const sell = pickNumber(raw, ['sell', 'ratingSell'])
  const strongSell = pickNumber(raw, ['strongSell', 'strong_sell', 'ratingStrongSell'])

  return {
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    rating: pickString(raw, ['rating', 'consensus', 'consensusRating', 'recommendation']),
    score: pickNumber(raw, ['score', 'consensusScore', 'ratingScore']),
  }
}

function buildRatingFromCounts(counts: {
  strongBuy: number | null
  buy: number | null
  hold: number | null
  sell: number | null
  strongSell: number | null
}) {
  const scoreMap = [
    { value: counts.strongBuy ?? 0, score: 5 },
    { value: counts.buy ?? 0, score: 4 },
    { value: counts.hold ?? 0, score: 3 },
    { value: counts.sell ?? 0, score: 2 },
    { value: counts.strongSell ?? 0, score: 1 },
  ]
  const total = scoreMap.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return { rating: null, score: null }

  const weighted = scoreMap.reduce((sum, item) => sum + item.value * item.score, 0) / total
  const rating =
    weighted >= 4.5
      ? 'Strong Buy'
      : weighted >= 3.5
        ? 'Buy'
        : weighted >= 2.5
          ? 'Hold'
          : weighted >= 1.5
            ? 'Sell'
            : 'Strong Sell'

  return {
    rating,
    score: Number(weighted.toFixed(2)),
  }
}

function normalizePriceTargetWindows(raw: any) {
  const labels: Array<{ label: string; keys: string[]; countKeys: string[] }> = [
    {
      label: '1 Month',
      keys: ['lastMonthAvgPriceTarget', 'priceTarget1m', 'lastMonth', 'month1', 'oneMonth'],
      countKeys: ['lastMonthCount', 'analystCount1m', 'numberOfAnalysts1m'],
    },
    {
      label: '3 Months',
      keys: ['lastQuarterAvgPriceTarget', 'priceTarget3m', 'lastQuarter', 'threeMonth', 'threeMonths'],
      countKeys: ['lastQuarterCount', 'analystCount3m', 'numberOfAnalysts3m'],
    },
    {
      label: '12 Months',
      keys: ['lastYearAvgPriceTarget', 'priceTarget12m', 'year', 'oneYear', 'twelveMonth'],
      countKeys: ['lastYearCount', 'analystCount12m', 'numberOfAnalysts12m'],
    },
    {
      label: 'All Time',
      keys: ['allTimeAvgPriceTarget', 'allTime'],
      countKeys: ['allTimeCount'],
    },
  ]

  return labels
    .map((item) => ({
      label: item.label,
      consensus: pickNumber(raw, item.keys),
      analystCount: pickNumber(raw, item.countKeys),
    }))
    .filter((item) => item.consensus !== null || item.analystCount !== null)
}

function buildTargetRevisionSeries(
  currentConsensus: { consensus: number | null; analystCount: number | null } | null,
  windows: Array<{ label: string; consensus: number | null; analystCount: number | null }>,
) {
  const historical = windows.filter((window) => window.consensus !== null)
  const current = currentConsensus && currentConsensus.consensus !== null
    ? [{ label: 'Current', value: currentConsensus.consensus, analystCount: currentConsensus.analystCount }]
    : []

  return [...historical.map((window) => ({
    label: window.label,
    value: window.consensus,
    analystCount: window.analystCount,
  })), ...current]
}

function analystFeedHasCoverage(feed: {
  priceTargetConsensus: { consensus: number | null } | null
  priceTargetSummary: Array<{ consensus: number | null }>
  gradesConsensus: { rating: string | null } | null
  latestActions: unknown[]
  historicalActions: unknown[]
}) {
  return Boolean(
    feed.priceTargetConsensus?.consensus !== null ||
      feed.priceTargetSummary.some((item) => item.consensus !== null) ||
      feed.gradesConsensus?.rating ||
      feed.latestActions.length > 0 ||
      feed.historicalActions.length > 0,
  )
}

function noteMeansProviderLimited(note?: string) {
  const normalized = note?.toLowerCase() ?? ''
  return normalized.includes('rate-limit') || normalized.includes('reached its analyst-data limit')
}

function noteMeansProviderRejected(note?: string) {
  const normalized = note?.toLowerCase() ?? ''
  return normalized.includes('rejected the saved api key')
}

async function buildFmpAnalystFeed(symbol: string, currentPriceOverride?: number | null) {
  const normalizedSymbol = normalizeSymbol(symbol)
  const apiKey = getAnalystFeedApiKey()

  if (!apiKey) {
    return {
      configured: false,
      provider: 'Financial Modeling Prep',
      symbol: normalizedSymbol,
      currentPrice: null,
      updatedAt: null,
      note: 'Add FMP_API_KEY to your environment variables to unlock analyst consensus targets and rating actions.',
      priceTargetConsensus: null,
      priceTargetSummary: [],
      targetRevision: [],
      gradesConsensus: null,
      latestActions: [],
      historicalActions: [],
    }
  }

  const currentPrice =
    currentPriceOverride ??
    extractQuoteFromChart(await fetchChart(normalizedSymbol, '1d'), normalizedSymbol, normalizedSymbol).price

  const [priceTargetConsensusResult, priceTargetSummaryResult, gradesResult, gradesHistoricalResult, gradesConsensusResult] = await Promise.all([
    fetchFmpSafe<any[]>('/stable/price-target-consensus', { symbol: normalizedSymbol }, apiKey),
    fetchFmpSafe<any[]>('/stable/price-target-summary', { symbol: normalizedSymbol }, apiKey),
    fetchFmpSafe<any[]>('/stable/grades', { symbol: normalizedSymbol }, apiKey),
    fetchFmpSafe<any[]>('/stable/grades-historical', { symbol: normalizedSymbol }, apiKey),
    fetchFmpSafe<any[]>('/stable/grades-consensus', { symbol: normalizedSymbol }, apiKey),
  ])

  const providerErrors = [
    priceTargetConsensusResult.error,
    priceTargetSummaryResult.error,
    gradesResult.error,
    gradesHistoricalResult.error,
    gradesConsensusResult.error,
  ].filter((item): item is { status: number; body: string } => item !== null)
  const rateLimited = providerErrors.some((item) => item.status === 429)
  const providerUnavailable = providerErrors.some((item) => item.status >= 500)
  const providerRejected = providerErrors.some((item) => item.status === 401 || item.status === 403)
  const priceTargetConsensusRaw = priceTargetConsensusResult.data ?? []
  const priceTargetSummaryRaw = priceTargetSummaryResult.data ?? []
  const gradesRaw = gradesResult.data ?? []
  const gradesHistoricalRaw = gradesHistoricalResult.data ?? []
  const gradesConsensusRaw = gradesConsensusResult.data ?? []
  const priceTargetConsensusRow = Array.isArray(priceTargetConsensusRaw) ? priceTargetConsensusRaw[0] ?? null : priceTargetConsensusRaw
  const priceTargetRow = Array.isArray(priceTargetSummaryRaw) ? priceTargetSummaryRaw[0] ?? null : priceTargetSummaryRaw
  const gradesConsensusRow = Array.isArray(gradesConsensusRaw) ? gradesConsensusRaw[0] ?? null : gradesConsensusRaw
  const latestActions = (Array.isArray(gradesRaw) ? gradesRaw : []).map(normalizeAnalystAction).slice(0, 12)
  const historicalActions = (Array.isArray(gradesHistoricalRaw) ? gradesHistoricalRaw : []).map(normalizeAnalystAction).slice(0, 20)
  const normalizedSummary = priceTargetRow ? normalizePriceTargetWindows(priceTargetRow) : []
  const normalizedConsensus = priceTargetConsensusRow
    ? normalizePriceTargetSummary(
        {
          ...priceTargetConsensusRow,
          analystCount:
            pickNumber(priceTargetRow, ['lastQuarterCount', 'lastYearCount', 'allTimeCount']) ??
            null,
        },
        currentPrice,
      )
    : null
  const targetRevision = buildTargetRevisionSeries(normalizedConsensus, normalizedSummary)
  const hasCoverage =
    normalizedConsensus !== null ||
    normalizedSummary.length > 0 ||
    (gradesConsensusRow && normalizeGradesConsensus(gradesConsensusRow).rating !== null) ||
    latestActions.length > 0 ||
    historicalActions.length > 0
  const providerNote = rateLimited
    ? 'The analyst provider is rate-limiting or your current FMP plan has reached its analyst-data limit. The key is configured, but the provider is rejecting analyst requests right now.'
    : providerRejected
      ? 'The analyst provider rejected the saved API key. Re-save the key or check whether your FMP plan includes these analyst endpoints.'
      : providerUnavailable
        ? 'The analyst provider is temporarily unavailable right now.'
        : undefined

  return {
    configured: true,
    provider: 'Financial Modeling Prep',
    symbol: normalizedSymbol,
    currentPrice,
    updatedAt: Math.floor(Date.now() / 1000),
    note:
      providerNote ??
      (hasCoverage
        ? undefined
        : `No dedicated analyst coverage is available for ${normalizedSymbol} right now. This is common for some ETFs and non-covered instruments.`),
    priceTargetConsensus: normalizedConsensus,
    priceTargetSummary: normalizedSummary,
    targetRevision,
    gradesConsensus: gradesConsensusRow ? normalizeGradesConsensus(gradesConsensusRow) : null,
    latestActions,
    historicalActions,
  }
}

async function buildTwelveDataAnalystFeed(
  symbol: string,
  currentPriceOverride?: number | null,
  asFallback = false,
) {
  const normalizedSymbol = normalizeSymbol(symbol)
  const apiKey = getTwelveDataApiKey()

  if (!apiKey) {
    return {
      configured: false,
      provider: asFallback ? 'Twelve Data (fallback)' : 'Twelve Data',
      symbol: normalizedSymbol,
      currentPrice: null,
      updatedAt: null,
      note: 'Add TWELVEDATA_API_KEY to your environment variables to enable the Twelve Data analyst fallback.',
      priceTargetConsensus: null,
      priceTargetSummary: [],
      targetRevision: [],
      gradesConsensus: null,
      latestActions: [],
      historicalActions: [],
    }
  }

  const currentPrice =
    currentPriceOverride ??
    extractQuoteFromChart(await fetchChart(normalizedSymbol, '1d'), normalizedSymbol, normalizedSymbol).price

  const [priceTargetResult, recommendationsResult] = await Promise.all([
    fetchTwelveDataSafe<any>('/price_target', { symbol: normalizedSymbol }, apiKey),
    fetchTwelveDataSafe<any>('/recommendations', { symbol: normalizedSymbol }, apiKey),
  ])

  const embeddedErrors = [
    getEmbeddedProviderError(priceTargetResult.data),
    getEmbeddedProviderError(recommendationsResult.data),
  ].filter((item): item is { status: number; body: string } => item !== null)
  const providerErrors = [priceTargetResult.error, recommendationsResult.error, ...embeddedErrors].filter(
    (item): item is { status: number; body: string } => item !== null,
  )
  const rateLimited = providerErrors.some((item) => item.status === 429)
  const providerUnavailable = providerErrors.some((item) => item.status >= 500)
  const planGated = providerErrors.some((item) => item.status === 403 && item.body.toLowerCase().includes('available exclusively'))
  const providerRejected = providerErrors.some((item) => item.status === 401) || providerErrors.some((item) => item.status === 403 && !item.body.toLowerCase().includes('available exclusively'))

  const priceTargetPayload = getEmbeddedProviderError(priceTargetResult.data) ? null : priceTargetResult.data
  const recommendationsPayload = getEmbeddedProviderError(recommendationsResult.data) ? null : recommendationsResult.data
  const latestRecommendation = recommendationsPayload?.trends?.current_month ?? null
  const latestActions: any[] = []
  const historicalActions: any[] = []
  const priceTargetConsensus = priceTargetPayload?.price_target
    ? normalizePriceTargetSummary(
        {
          targetHigh: pickNumber(priceTargetPayload.price_target, ['high']),
          targetLow: pickNumber(priceTargetPayload.price_target, ['low']),
          targetMedian: pickNumber(priceTargetPayload.price_target, ['median']),
          targetAverage: pickNumber(priceTargetPayload.price_target, ['average']),
        },
        pickNumber(priceTargetPayload.price_target, ['current']) ?? currentPrice,
      )
    : null
  const gradesCounts = latestRecommendation
    ? normalizeGradesConsensus({
        strongBuy: pickNumber(latestRecommendation, ['strong_buy', 'strongBuy']),
        buy: pickNumber(latestRecommendation, ['buy']),
        hold: pickNumber(latestRecommendation, ['hold']),
        sell: pickNumber(latestRecommendation, ['sell']),
        strongSell: pickNumber(latestRecommendation, ['strong_sell', 'strongSell']),
      })
    : null
  const gradesConsensus = gradesCounts
    ? {
        ...gradesCounts,
        ...buildRatingFromCounts(gradesCounts),
      }
    : null
  const targetRevision = buildTargetRevisionSeries(priceTargetConsensus, [])
  const hasCoverage = analystFeedHasCoverage({
    priceTargetConsensus,
    priceTargetSummary: [],
    gradesConsensus,
    latestActions,
    historicalActions,
  })
  const providerNote = rateLimited
    ? 'The Twelve Data analyst fallback is rate-limiting this symbol right now.'
    : planGated
      ? 'Your Twelve Data plan does not include analyst coverage for this symbol or endpoint.'
    : providerRejected
      ? 'The saved Twelve Data API key was rejected.'
      : providerUnavailable
        ? 'The Twelve Data analyst fallback is temporarily unavailable right now.'
        : undefined

  return {
    configured: true,
    provider: asFallback ? 'Twelve Data (fallback)' : 'Twelve Data',
    symbol: normalizedSymbol,
    currentPrice,
    updatedAt: Math.floor(Date.now() / 1000),
    note:
      providerNote ??
      (hasCoverage
        ? asFallback
          ? 'FMP is currently unavailable or rate-limited, so this view is coming from Twelve Data fallback coverage.'
          : undefined
        : `No fallback analyst coverage is available for ${normalizedSymbol} right now.`),
    priceTargetConsensus,
    priceTargetSummary: [],
    targetRevision,
    gradesConsensus,
    latestActions,
    historicalActions,
  }
}

async function buildAnalystFeed(symbol: string, currentPriceOverride?: number | null) {
  const fmpKey = getAnalystFeedApiKey()
  const twelveDataKey = getTwelveDataApiKey()

  if (fmpKey) {
    const primaryFeed = await buildFmpAnalystFeed(symbol, currentPriceOverride)
    if (
      twelveDataKey &&
      (noteMeansProviderLimited(primaryFeed.note) || noteMeansProviderRejected(primaryFeed.note))
    ) {
      const fallbackFeed = await buildTwelveDataAnalystFeed(symbol, primaryFeed.currentPrice, true)
      if (analystFeedHasCoverage(fallbackFeed) || fallbackFeed.configured) {
        return fallbackFeed
      }
    }
    return primaryFeed
  }

  if (twelveDataKey) {
    return buildTwelveDataAnalystFeed(symbol, currentPriceOverride)
  }

  return {
    configured: false,
    provider: 'Analyst providers',
    symbol: normalizeSymbol(symbol),
    currentPrice: null,
    updatedAt: null,
    note: 'Add FMP_API_KEY for the primary feed and optionally TWELVEDATA_API_KEY for analyst fallback coverage.',
    priceTargetConsensus: null,
    priceTargetSummary: [],
    targetRevision: [],
    gradesConsensus: null,
    latestActions: [],
    historicalActions: [],
  }
}

function parsePortfolioPosition(input: unknown): PortfolioPositionEntry | { error: string } {
  const raw = input as Partial<PortfolioPositionEntry> | undefined
  const symbol = typeof raw?.symbol === 'string' ? normalizeSymbol(raw.symbol) : ''
  const shares = Number(raw?.shares)
  const costBasis = Number(raw?.costBasis)
  const dateAdded = typeof raw?.dateAdded === 'string' ? raw.dateAdded : ''

  if (!symbol) return { error: 'symbol is required' }
  if (!Number.isFinite(shares) || shares <= 0) return { error: 'shares must be greater than 0' }
  if (!Number.isFinite(costBasis) || costBasis < 0) return { error: 'costBasis must be 0 or greater' }
  if (!dateAdded || Number.isNaN(Date.parse(dateAdded))) return { error: 'dateAdded must be a valid date' }

  return {
    symbol,
    shares,
    costBasis,
    dateAdded,
  }
}

async function buildPortfolioSnapshot(items: PortfolioPositionEntry[]) {
  const results = await Promise.allSettled(items.map((item) => fetchChart(item.symbol, '1d')))
  const positions = items.map((item, index) => {
    const result = results[index]
    let price = 0
    let name = item.symbol

    if (result.status === 'fulfilled') {
      const quote = extractQuoteFromChart(result.value, item.symbol, item.symbol)
      price = quote.price
      name = quote.name
    }

    const totalCost = item.shares * item.costBasis
    const marketValue = item.shares * price
    const plDollar = marketValue - totalCost
    const plPercent = totalCost !== 0 ? (plDollar / totalCost) * 100 : 0

    return {
      ...item,
      name,
      currentPrice: price,
      marketValue,
      plDollar,
      plPercent,
    }
  })

  const totalCost = positions.reduce((sum, position) => sum + position.shares * position.costBasis, 0)
  const totalMarketValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const totalPlDollar = totalMarketValue - totalCost
  const totalPlPercent = totalCost !== 0 ? (totalPlDollar / totalCost) * 100 : 0

  return {
    positions,
    totals: {
      totalCost,
      totalMarketValue,
      totalPlDollar,
      totalPlPercent,
    },
  }
}

router.get('/indices', async (_req, res) => {
  try {
    const symbols = Object.keys(INDEX_META)
    const results = await Promise.allSettled(symbols.map((symbol) => fetchChart(symbol, '1d')))
    const indices = results.map((result, index) => {
      const symbol = symbols[index]
      const name = INDEX_META[symbol]
      if (result.status === 'rejected') {
        return { symbol, name, price: 0, change: 0, changePercent: 0, marketState: 'CLOSED', sparkline: [] }
      }

      try {
        const quote = extractQuoteFromChart(result.value, symbol, name)
        return {
          symbol,
          name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketState: quote.marketState,
          sparkline: quote.sparkline,
        }
      } catch {
        return { symbol, name, price: 0, change: 0, changePercent: 0, marketState: 'CLOSED', sparkline: [] }
      }
    })

    res.json(indices)
  } catch {
    res.status(500).json({ error: 'Failed to fetch indices' })
  }
})

router.get('/chart/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol
    const range = normalizeChartRange(typeof req.query.range === 'string' ? req.query.range : undefined)
    const interval = typeof req.query.interval === 'string' ? req.query.interval : undefined
    const chart = await fetchChart(symbol, range, interval)
    res.json(buildChartResponse(chart, symbol, range, interval))
  } catch {
    res.status(500).json({ error: 'Failed to fetch chart data' })
  }
})

router.get('/quote/:symbol', async (req, res) => {
  try {
    const quote = await buildDetailedQuote(req.params.symbol)
    res.json(quote)
  } catch {
    res.status(500).json({ error: 'Failed to fetch quote details' })
  }
})

router.get('/history/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol)
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : ''
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : ''
    const interval = normalizeHistoricalInterval(typeof req.query.interval === 'string' ? req.query.interval : undefined)

    const chart = await fetchHistoricalChart(symbol, startDate, endDate, interval)
    const result = getChartResult(chart, symbol)
    const points = buildHistoricalPoints(result).filter((point) => point.close !== null)

    res.json({
      symbol: result?.meta?.symbol ?? symbol,
      name: result?.meta?.longName ?? result?.meta?.shortName ?? symbol,
      currency: result?.meta?.currency ?? 'USD',
      interval,
      startDate,
      endDate,
      points,
      summary: buildHistorySummary(points),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Invalid historical date range') {
      return res.status(400).json({ error: message })
    }
    res.status(500).json({ error: 'Failed to fetch historical data' })
  }
})

router.get('/insight/:symbol', async (req, res) => {
  try {
    const insight = await buildMarketInsight(req.params.symbol)
    res.json(insight)
  } catch {
    res.status(500).json({ error: 'Failed to build market insight' })
  }
})

router.get('/ai-insight/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol)
    const settings = readSettings()
    const ttl = settings.aiRefreshSeconds ?? 120

    // Check in-memory cache first
    const cached = getCachedAiInsight(symbol, ttl)
    if (cached) {
      const base = await buildMarketInsight(symbol)
      return res.json({
        ...base,
        aiProvider: cached.provider,
        aiProviderLabel: cached.label,
        aiSummary: cached.text,
      })
    }

    // Build deterministic base
    const [insight, intradayChart] = await Promise.all([
      buildMarketInsight(symbol),
      fetchChart(symbol, '1d').catch(() => null),
    ])

    const quoteFromChart = intradayChart ? extractQuoteFromChart(intradayChart, symbol, symbol) : null
    const currentPrice = quoteFromChart?.price ?? null
    const changePercent = quoteFromChart?.changePercent ?? null

    const provider = detectAiProvider()
    let aiText: string | null = null

    if (provider !== 'fallback') {
      const prompt = buildAiPrompt(symbol, insight.name, insight, currentPrice, changePercent)
      aiText = await generateAiInsight(prompt)
    }

    const finalProvider = aiText ? provider : 'fallback'
    const finalLabel = aiProviderLabel(finalProvider)
    const finalSummary = aiText ?? insight.aiSummary

    // Cache the AI result
    setCachedAiInsight(symbol, finalProvider, finalLabel, finalSummary)

    return res.json({
      ...insight,
      aiProvider: finalProvider,
      aiProviderLabel: finalLabel,
      aiSummary: finalSummary,
    })
  } catch {
    res.status(500).json({ error: 'Failed to build AI insight' })
  }
})

router.get('/analyst/:symbol', async (req, res) => {
  try {
    res.json(await buildAnalystFeed(req.params.symbol))
  } catch {
    res.status(500).json({ error: 'Failed to fetch analyst feed' })
  }
})

router.get('/movers', async (_req, res) => {
  try {
    const [gainers, losers] = await Promise.all([
      fetchScreenerQuotes('day_gainers', 5),
      fetchScreenerQuotes('day_losers', 5),
    ])

    res.json({
      gainers: gainers.map((quote) => ({
        symbol: quote.symbol,
        name: quote.longName ?? quote.shortName ?? quote.symbol,
        price: toNumber(quote.regularMarketPrice) ?? 0,
        change: toNumber(quote.regularMarketChange) ?? 0,
        changePercent: toNumber(quote.regularMarketChangePercent) ?? 0,
      })),
      losers: losers.map((quote) => ({
        symbol: quote.symbol,
        name: quote.longName ?? quote.shortName ?? quote.symbol,
        price: toNumber(quote.regularMarketPrice) ?? 0,
        change: toNumber(quote.regularMarketChange) ?? 0,
        changePercent: toNumber(quote.regularMarketChangePercent) ?? 0,
      })),
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch market movers' })
  }
})

router.get('/global', async (_req, res) => {
  try {
    const results = await Promise.allSettled(GLOBAL_ASSETS.map((asset) => fetchChart(asset.symbol, '1d')))
    const assets = results.map((result, index) => {
      const asset = GLOBAL_ASSETS[index]
      if (result.status === 'rejected') {
        return {
          symbol: asset.symbol,
          name: asset.name,
          price: 0,
          change: 0,
          changePercent: 0,
          marketState: 'CLOSED',
          sparkline: [],
        }
      }

      try {
        const quote = extractQuoteFromChart(result.value, asset.symbol, asset.name)
        return {
          symbol: asset.symbol,
          name: asset.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketState: quote.marketState,
          sparkline: quote.sparkline,
        }
      } catch {
        return {
          symbol: asset.symbol,
          name: asset.name,
          price: 0,
          change: 0,
          changePercent: 0,
          marketState: 'CLOSED',
          sparkline: [],
        }
      }
    })

    res.json(assets)
  } catch {
    res.status(500).json({ error: 'Failed to fetch global markets' })
  }
})

router.get('/watchlist', async (_req, res) => {
  try {
    const stored = readStore<WatchlistEntry>('watchlist.json')
    const tickers = stored.length > 0 ? stored.map((entry) => entry.symbol) : DEFAULT_WATCHLIST
    const [charts, shares] = await Promise.all([
      Promise.allSettled(tickers.map((symbol) => fetchChart(symbol, '1d'))),
      Promise.allSettled(tickers.map((symbol) => fetchTimeseriesValue(symbol, 'quarterlyDilutedAverageShares'))),
    ])

    const stocks = charts.map((result, index) => {
      const symbol = tickers[index]
      if (result.status === 'rejected') {
        return {
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          marketState: 'CLOSED',
          sparkline: [],
          volume: '--',
          marketCap: '--',
        }
      }

      try {
        const quote = extractQuoteFromChart(result.value, symbol, symbol)
        const volume = formatVolume(toNumber(quote.meta.regularMarketVolume))
        const shareCountResult = shares[index]
        const shareCount = shareCountResult.status === 'fulfilled' ? shareCountResult.value : null
        const marketCap = formatMarketCap(shareCount !== null ? quote.price * shareCount : null)

        return {
          symbol,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketState: quote.marketState,
          sparkline: quote.sparkline,
          volume,
          marketCap,
        }
      } catch {
        return {
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          marketState: 'CLOSED',
          sparkline: [],
          volume: '--',
          marketCap: '--',
        }
      }
    })

    res.json(stocks)
  } catch {
    res.status(500).json({ error: 'Failed to fetch watchlist' })
  }
})

router.post('/watchlist', (req, res) => {
  try {
    const symbol = typeof req.body?.symbol === 'string' ? normalizeSymbol(req.body.symbol) : ''
    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' })
    }

    const stored = readStore<WatchlistEntry>('watchlist.json')
    const current = stored.length > 0 ? stored : DEFAULT_WATCHLIST.map((ticker) => ({ symbol: ticker }))
    if (current.some((entry) => entry.symbol === symbol)) {
      return res.status(409).json({ error: 'Ticker already in watchlist' })
    }

    writeStore('watchlist.json', [...current, { symbol }])
    res.status(201).json({ symbol })
  } catch {
    res.status(500).json({ error: 'Failed to update watchlist' })
  }
})

router.delete('/watchlist/:ticker', (req, res) => {
  try {
    const ticker = normalizeSymbol(req.params.ticker)
    const stored = readStore<WatchlistEntry>('watchlist.json')
    const current = stored.length > 0 ? stored : DEFAULT_WATCHLIST.map((symbol) => ({ symbol }))
    writeStore(
      'watchlist.json',
      current.filter((entry) => entry.symbol !== ticker),
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to update watchlist' })
  }
})

router.get('/news', async (_req, res) => {
  try {
    res.json(await fetchRelevantNews('stock market today', 12))
  } catch {
    res.status(500).json({ error: 'Failed to fetch news' })
  }
})

router.get('/sectors', async (_req, res) => {
  try {
    const results = await Promise.allSettled(SECTOR_META.map((sector) => fetchChart(sector.symbol, '1d')))
    const sectors = results.map((result, index) => {
      const sector = SECTOR_META[index]
      if (result.status === 'rejected') {
        return { ...sector, change: 0, changePercent: 0, weight: 1 }
      }

      try {
        const quote = extractQuoteFromChart(result.value, sector.symbol, sector.name)
        const volume = toNumber(quote.meta.regularMarketVolume) ?? 0
        return {
          symbol: sector.symbol,
          name: sector.name,
          change: quote.change,
          changePercent: quote.changePercent,
          weight: Math.max(quote.price * volume, 1),
        }
      } catch {
        return { ...sector, change: 0, changePercent: 0, weight: 1 }
      }
    })

    res.json(sectors)
  } catch {
    res.status(500).json({ error: 'Failed to fetch sectors' })
  }
})

router.get('/portfolio', async (_req, res) => {
  try {
    const items = readStore<PortfolioPositionEntry>('portfolio.json')
    res.json(await buildPortfolioSnapshot(items))
  } catch {
    res.status(500).json({ error: 'Failed to fetch portfolio' })
  }
})

router.post('/portfolio', async (req, res) => {
  try {
    const parsed = parsePortfolioPosition(req.body)
    if ('error' in parsed) {
      return res.status(400).json(parsed)
    }

    const current = readStore<PortfolioPositionEntry>('portfolio.json')
    if (current.some((entry) => entry.symbol === parsed.symbol)) {
      return res.status(409).json({ error: 'Position already exists for symbol' })
    }

    writeStore('portfolio.json', [...current, parsed])
    res.status(201).json(parsed)
  } catch {
    res.status(500).json({ error: 'Failed to create portfolio position' })
  }
})

router.put('/portfolio/:symbol', async (req, res) => {
  try {
    const currentSymbol = normalizeSymbol(req.params.symbol)
    const parsed = parsePortfolioPosition(req.body)
    if ('error' in parsed) {
      return res.status(400).json(parsed)
    }

    const current = readStore<PortfolioPositionEntry>('portfolio.json')
    const existingIndex = current.findIndex((entry) => entry.symbol === currentSymbol)
    if (existingIndex === -1) {
      return res.status(404).json({ error: 'Position not found' })
    }

    if (parsed.symbol !== currentSymbol && current.some((entry) => entry.symbol === parsed.symbol)) {
      return res.status(409).json({ error: 'Position already exists for symbol' })
    }

    const updated = [...current]
    updated[existingIndex] = parsed
    writeStore('portfolio.json', updated)
    res.json(parsed)
  } catch {
    res.status(500).json({ error: 'Failed to update portfolio position' })
  }
})

router.delete('/portfolio/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol)
    const current = readStore<PortfolioPositionEntry>('portfolio.json')
    writeStore(
      'portfolio.json',
      current.filter((entry) => entry.symbol !== symbol),
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete portfolio position' })
  }
})

// ─── Sector Constituents ────────────────────────────────────────────────────

const OUR_TO_FMP_SECTOR: Record<string, string> = {
  Technology: 'Technology',
  Healthcare: 'Healthcare',
  Financials: 'Financial Services',
  'Consumer Discretionary': 'Consumer Cyclical',
  'Consumer Staples': 'Consumer Defensive',
  'Communication Services': 'Communication Services',
  Industrials: 'Industrials',
  Energy: 'Energy',
  Materials: 'Basic Materials',
  'Real Estate': 'Real Estate',
  Utilities: 'Utilities',
}

const ETF_NAMES: Record<string, string> = {
  XLC: 'Communication Services Select Sector SPDR',
  XLY: 'Consumer Discretionary Select Sector SPDR',
  XLP: 'Consumer Staples Select Sector SPDR',
  XLE: 'Energy Select Sector SPDR',
  XLF: 'Financial Select Sector SPDR',
  XLV: 'Health Care Select Sector SPDR',
  XLI: 'Industrial Select Sector SPDR',
  XLB: 'Materials Select Sector SPDR',
  XLRE: 'Real Estate Select Sector SPDR',
  XLK: 'Technology Select Sector SPDR',
  XLU: 'Utilities Select Sector SPDR',
}

router.get('/sectors/:etf/constituents', async (req, res) => {
  const etf = (req.params.etf ?? '').toUpperCase()
  if (!etf) return res.status(400).json({ error: 'ETF symbol required' })

  try {
    // Always fetch the ETF quote itself
    const etfChartData = await fetchChart(etf, '1d').catch(() => null)
    const etfQuote = etfChartData ? extractQuoteFromChart(etfChartData, etf, ETF_NAMES[etf] ?? etf) : null

    const fmpKey = getAnalystFeedApiKey()
    let constituents: Array<{
      symbol: string
      name: string
      weight: number
      price: number | null
      change: number | null
      changePercent: number | null
      marketCap: string | null
      shares: number | null
    }> = []
    let hasFmpData = false

    if (fmpKey) {
      // FMP path: get ETF holders
      const { data: holders } = await fetchFmpSafe<Array<{ asset: string; shares: number; weightPercentage: number; name: string }>>(
        `/api/v3/etf-holder/${encodeURIComponent(etf)}`,
        { limit: 25 },
        fmpKey,
      )

      if (holders && holders.length > 0) {
        hasFmpData = true
        const top = holders.slice(0, 20)
        const symbols = top.map((h) => h.asset).filter(Boolean)

        // Batch fetch quotes for constituents
        const quoteResults = await Promise.allSettled(symbols.map((s) => fetchChart(s, '1d')))

        constituents = top.map((holder, index) => {
          const symbol = holder.asset
          const quoteResult = quoteResults[index]
          if (!symbol) return null

          let price: number | null = null
          let change: number | null = null
          let changePercent: number | null = null
          let marketCapStr: string | null = null

          if (quoteResult.status === 'fulfilled') {
            try {
              const q = extractQuoteFromChart(quoteResult.value, symbol, symbol)
              price = q.price
              change = q.change
              changePercent = q.changePercent
              const vol = toNumber(q.meta.regularMarketVolume)
              if (vol && price) marketCapStr = formatMarketCap(price * vol)
            } catch {
              // keep nulls
            }
          }

          return {
            symbol,
            name: holder.name ?? symbol,
            weight: toNumber(holder.weightPercentage) ?? 0,
            price,
            change,
            changePercent,
            marketCap: marketCapStr,
            shares: toNumber(holder.shares),
          }
        }).filter((c): c is NonNullable<typeof c> => c !== null)
      }
    }

    if (!hasFmpData) {
      // Yahoo fallback: quoteSummary topHoldings
      try {
        const summaryUrl =
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(etf)}` +
          `?modules=topHoldings`
        const summaryData = await fetchJson<any>(summaryUrl)
        const holdings: Array<{ symbol: string; holdingName: string; holdingPercent: { raw: number } }> =
          summaryData?.quoteSummary?.result?.[0]?.topHoldings?.holdings ?? []

        if (holdings.length > 0) {
          const symbols = holdings.map((h) => h.symbol).filter(Boolean).slice(0, 15)
          const quoteResults = await Promise.allSettled(symbols.map((s) => fetchChart(s, '1d')))

          constituents = holdings.slice(0, 15).map((holding, index) => {
            const symbol = holding.symbol
            if (!symbol) return null

            const quoteResult = quoteResults[index]
            let price: number | null = null
            let change: number | null = null
            let changePercent: number | null = null
            let marketCapStr: string | null = null

            if (quoteResult?.status === 'fulfilled') {
              try {
                const q = extractQuoteFromChart(quoteResult.value, symbol, symbol)
                price = q.price
                change = q.change
                changePercent = q.changePercent
                const vol = toNumber(q.meta.regularMarketVolume)
                if (vol && price) marketCapStr = formatMarketCap(price * vol)
              } catch {
                // keep nulls
              }
            }

            return {
              symbol,
              name: holding.holdingName ?? symbol,
              weight: (toNumber(holding.holdingPercent?.raw) ?? 0) * 100,
              price,
              change,
              changePercent,
              marketCap: marketCapStr,
              shares: null,
            }
          }).filter((c): c is NonNullable<typeof c> => c !== null)
        }
      } catch {
        // Yahoo fallback also failed — return empty
      }
    }

    res.json({
      etf,
      name: etfQuote?.name ?? ETF_NAMES[etf] ?? etf,
      price: etfQuote?.price ?? 0,
      change: etfQuote?.change ?? 0,
      changePercent: etfQuote?.changePercent ?? 0,
      hasFmpData,
      constituents,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch sector constituents' })
  }
})

// ─── Stock Screener ──────────────────────────────────────────────────────────

const screenerCache = new Map<string, { t: number; data: unknown }>()
const SCREENER_TTL_MS = 60_000

function fmtVolume(v: number | null | undefined): string {
  if (!v) return '--'
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

function fmtMktCap(v: number | null | undefined): string {
  if (!v) return '--'
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${Math.round(v)}`
}

router.get('/screener', async (req, res) => {
  const cacheKey = JSON.stringify(req.query)
  const cached = screenerCache.get(cacheKey)
  if (cached && Date.now() - cached.t < SCREENER_TTL_MS) {
    return res.json(cached.data)
  }

  const sector = typeof req.query.sector === 'string' ? req.query.sector : undefined
  const minPrice = toNumber(req.query.minPrice as string)
  const maxPrice = toNumber(req.query.maxPrice as string)
  const minChange = toNumber(req.query.minChange as string)
  const maxChange = toNumber(req.query.maxChange as string)
  const minPe = toNumber(req.query.minPe as string)
  const maxPe = toNumber(req.query.maxPe as string)
  const minVolume = toNumber(req.query.minVolume as string)
  const minMarketCap = toNumber(req.query.minMarketCap as string)
  const maxMarketCap = toNumber(req.query.maxMarketCap as string)
  const limit = Math.min(toNumber(req.query.limit as string) ?? 50, 200)

  try {
    const fmpKey = getAnalystFeedApiKey()

    if (fmpKey) {
      // FMP screener path
      const fmpParams: Record<string, string | number | undefined> = {
        isEtf: 'false',
        country: 'US',
        isActivelyTrading: 'true',
        limit: 200,
      }
      if (sector) fmpParams.sector = OUR_TO_FMP_SECTOR[sector] ?? sector
      if (minPrice !== null) fmpParams.priceMoreThan = minPrice
      if (maxPrice !== null) fmpParams.priceLowerThan = maxPrice
      if (minVolume !== null) fmpParams.volumeMoreThan = minVolume
      if (minMarketCap !== null) fmpParams.marketCapMoreThan = minMarketCap
      if (maxMarketCap !== null) fmpParams.marketCapLowerThan = maxMarketCap

      const { data: fmpResults } = await fetchFmpSafe<Array<{
        symbol: string
        companyName: string
        marketCap: number
        sector: string
        industry: string
        price: number
        volume: number
        exchange: string
        beta?: number
      }>>('/api/v3/stock-screener', fmpParams, fmpKey)

      if (fmpResults && Array.isArray(fmpResults)) {
        let results = fmpResults.map((item) => ({
          symbol: item.symbol,
          name: item.companyName ?? item.symbol,
          sector: item.sector ?? null,
          price: toNumber(item.price),
          changePercent: null as number | null,
          marketCap: toNumber(item.marketCap),
          marketCapFormatted: fmtMktCap(toNumber(item.marketCap)),
          peRatio: null as number | null,
          volume: toNumber(item.volume),
          volumeFormatted: fmtVolume(toNumber(item.volume)),
          exchange: item.exchange ?? null,
        }))

        // Apply in-memory P/E filter (FMP screener doesn't support it natively)
        // Skip P/E for FMP path since we don't have it — note this limitation
        if (minChange !== null || maxChange !== null) {
          // Can't filter by changePercent without extra requests — skip silently
        }

        results = results.slice(0, limit)

        const response = { hasFmpData: true, total: results.length, results }
        screenerCache.set(cacheKey, { t: Date.now(), data: response })
        return res.json(response)
      }
    }

    // Yahoo fallback: merge several predefined screeners
    const screenerIds = ['most_actives', 'day_gainers', 'day_losers', 'growth_technology_stocks', 'undervalued_large_caps']
    const counts = [50, 25, 25, 25, 25]

    const allResults = await Promise.allSettled(
      screenerIds.map((id, i) => fetchScreenerQuotes(id, counts[i]))
    )

    const seen = new Set<string>()
    const merged: Array<{
      symbol: string
      name: string
      sector: string | null
      price: number | null
      changePercent: number | null
      marketCap: number | null
      marketCapFormatted: string
      peRatio: number | null
      volume: number | null
      volumeFormatted: string
      exchange: string | null
    }> = []

    for (const result of allResults) {
      if (result.status === 'rejected') continue
      for (const quote of result.value) {
        const sym = quote.symbol
        if (!sym || seen.has(sym)) continue
        seen.add(sym)

        const price = toNumber(quote.regularMarketPrice)
        const changePercent = toNumber(quote.regularMarketChangePercent)
        const mktCap = toNumber(quote.marketCap)
        const vol = toNumber(quote.regularMarketVolume)
        const pe = toNumber(quote.trailingPE)
        const sectorVal: string | null = quote.sector ?? null

        // Apply filters
        if (sector && sectorVal !== sector) continue
        if (minPrice !== null && (price === null || price < minPrice)) continue
        if (maxPrice !== null && (price === null || price > maxPrice)) continue
        if (minChange !== null && (changePercent === null || changePercent < minChange)) continue
        if (maxChange !== null && (changePercent === null || changePercent > maxChange)) continue
        if (minPe !== null && (pe === null || pe < minPe)) continue
        if (maxPe !== null && (pe === null || pe > maxPe)) continue
        if (minVolume !== null && (vol === null || vol < minVolume)) continue
        if (minMarketCap !== null && (mktCap === null || mktCap < minMarketCap)) continue
        if (maxMarketCap !== null && (mktCap === null || mktCap > maxMarketCap)) continue

        merged.push({
          symbol: sym,
          name: quote.longName ?? quote.shortName ?? sym,
          sector: sectorVal,
          price,
          changePercent,
          marketCap: mktCap,
          marketCapFormatted: fmtMktCap(mktCap),
          peRatio: pe,
          volume: vol,
          volumeFormatted: fmtVolume(vol),
          exchange: quote.exchange ?? null,
        })

        if (merged.length >= limit) break
      }
      if (merged.length >= limit) break
    }

    const response = { hasFmpData: false, total: merged.length, results: merged }
    screenerCache.set(cacheKey, { t: Date.now(), data: response })
    res.json(response)
  } catch {
    res.status(500).json({ error: 'Failed to run screener' })
  }
})

export default router
