export type ChartRangeKey = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y'
export type HistoricalInterval = '1d' | '1wk' | '1mo'
export type MarketTone = 'bullish' | 'neutral' | 'bearish'
export type MarketChartStyle = 'area' | 'line' | 'candles'

export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
  sparkline: number[]
}

export interface WatchlistStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
  sparkline: number[]
  volume?: string
  marketCap?: string
}

export interface MarketNews {
  id: string
  title: string
  source: string
  url: string
  publishedAt: number
  sentiment?: MarketTone
  tags?: string[]
  relevanceScore?: number
}

export interface SectorPerformance {
  name: string
  symbol: string
  change: number
  changePercent: number
  weight: number
}

export interface MarketChartPoint {
  timestamp: number
  open: number | null
  high: number | null
  low: number | null
  close: number
  volume: number | null
}

export interface MarketChart {
  symbol: string
  name: string
  currency: string
  exchangeName: string
  marketState: string
  regularMarketTime: number | null
  price: number
  previousClose: number
  change: number
  changePercent: number
  range: ChartRangeKey
  interval: string
  dayHigh: number | null
  dayLow: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  points: MarketChartPoint[]
}

export interface MarketQuoteStats {
  open: number | null
  previousClose: number | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  peRatio: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  eps: number | null
  dividendYield: number | null
  avgVolume: number | null
  marketCap: number | null
}

export interface MarketQuoteDetail {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
  exchangeName: string
  currency: string
  regularMarketTime: number | null
  sector: string | null
  industry: string | null
  stats: MarketQuoteStats
}

export interface MarketMover {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface MarketMoversResponse {
  gainers: MarketMover[]
  losers: MarketMover[]
}

export interface GlobalMarketAsset {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
  sparkline: number[]
}

export interface PortfolioPositionInput {
  symbol: string
  shares: number
  costBasis: number
  dateAdded: string
}

export interface PortfolioPosition extends PortfolioPositionInput {
  name: string
  currentPrice: number
  marketValue: number
  plDollar: number
  plPercent: number
}

export interface PortfolioTotals {
  totalCost: number
  totalMarketValue: number
  totalPlDollar: number
  totalPlPercent: number
}

export interface PortfolioResponse {
  positions: PortfolioPosition[]
  totals: PortfolioTotals
}

export interface MarketHistoryPoint {
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

export interface MarketHistorySummary {
  rows: number
  highestHigh: number | null
  lowestLow: number | null
  latestClose: number | null
  latestAdjClose: number | null
  averageVolume: number | null
  absoluteChange: number | null
  percentChange: number | null
}

export interface MarketHistoryResponse {
  symbol: string
  name: string
  currency: string
  interval: HistoricalInterval
  startDate: string
  endDate: string
  points: MarketHistoryPoint[]
  summary: MarketHistorySummary
}

export interface MarketInsightSignal {
  positive: number
  negative: number
  neutral: number
  analystMentions: number
}

export interface MarketInsightHorizon {
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

export interface MarketInsightResponse {
  symbol: string
  name: string
  generatedAt: number
  overallTone: MarketTone
  dataFreshness: {
    marketDataTime: number | null
    analystDataTime: number | null
    headlineCount: number
  }
  aiProvider: 'claude' | 'openai' | 'fallback'
  aiProviderLabel: string
  streetSummary: string
  aiSummary: string
  methodology: string[]
  trustNotes: string[]
  signals: MarketInsightSignal
  keyLevels: {
    support: number | null
    resistance: number | null
    averageVolume: number | null
  }
  analystContext: {
    rating: string | null
    upsidePercent: number | null
    targetConsensus: number | null
    upgrades: number
    downgrades: number
    maintains: number
  }
  horizons: MarketInsightHorizon[]
  headlines: MarketNews[]
}

export interface AnalystPriceTargetConsensus {
  consensus: number | null
  high: number | null
  low: number | null
  median: number | null
  analystCount: number | null
  upsidePercent: number | null
}

export interface AnalystPriceTargetWindow {
  label: string
  consensus: number | null
  analystCount: number | null
}

export interface AnalystTargetRevisionPoint {
  label: string
  value: number | null
  analystCount: number | null
}

export interface AnalystConsensusCounts {
  strongBuy: number | null
  buy: number | null
  hold: number | null
  sell: number | null
  strongSell: number | null
  rating: string | null
  score: number | null
}

export interface AnalystActionItem {
  date: string | null
  firm: string | null
  action: string | null
  priorGrade: string | null
  newGrade: string | null
  publisher: string | null
}

export interface AnalystFeedResponse {
  configured: boolean
  provider: string
  symbol: string
  currentPrice: number | null
  updatedAt: number | null
  note?: string
  priceTargetConsensus: AnalystPriceTargetConsensus | null
  priceTargetSummary: AnalystPriceTargetWindow[]
  targetRevision: AnalystTargetRevisionPoint[]
  gradesConsensus: AnalystConsensusCounts | null
  latestActions: AnalystActionItem[]
  historicalActions: AnalystActionItem[]
}

export interface SectorConstituent {
  symbol: string
  name: string
  weight: number
  price: number | null
  change: number | null
  changePercent: number | null
  marketCap: string | null
  shares: number | null
}

export interface SectorDetailResponse {
  etf: string
  name: string
  price: number
  change: number
  changePercent: number
  hasFmpData: boolean
  constituents: SectorConstituent[]
}

export interface ScreenerResult {
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
}

export interface ScreenerFilters {
  sector?: string
  minPrice?: number
  maxPrice?: number
  minChange?: number
  maxChange?: number
  minPe?: number
  maxPe?: number
  minVolume?: number
  minMarketCap?: number
  maxMarketCap?: number
  limit?: number
}

export interface ScreenerResponse {
  hasFmpData: boolean
  total: number
  results: ScreenerResult[]
}
