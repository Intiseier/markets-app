import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api'
import type {
  AnalystFeedResponse,
  ChartRangeKey,
  GlobalMarketAsset,
  MarketChart,
  MarketHistoryResponse,
  MarketIndex,
  MarketInsightResponse,
  MarketMoversResponse,
  MarketNews,
  MarketQuoteDetail,
  HistoricalInterval,
  PortfolioPositionInput,
  PortfolioResponse,
  SectorDetailResponse,
  SectorPerformance,
  ScreenerFilters,
  ScreenerResponse,
  WatchlistStock,
} from '@/types/market'

export function useMarketIndices() {
  return useQuery<MarketIndex[]>({
    queryKey: ['markets', 'indices'],
    queryFn: () => apiFetch('/markets/indices'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useWatchlist() {
  return useQuery<WatchlistStock[]>({
    queryKey: ['markets', 'watchlist'],
    queryFn: () => apiFetch('/markets/watchlist'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useAddToWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) => apiPost('/markets/watchlist', { symbol }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets', 'watchlist'] }),
  })
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => apiDelete(`/markets/watchlist/${ticker}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets', 'watchlist'] }),
  })
}

export function useMarketNews() {
  return useQuery<MarketNews[]>({
    queryKey: ['markets', 'news'],
    queryFn: () => apiFetch('/markets/news'),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  })
}

export function useMarketSectors() {
  return useQuery<SectorPerformance[]>({
    queryKey: ['markets', 'sectors'],
    queryFn: () => apiFetch('/markets/sectors'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarketChart(symbol: string | null | undefined, range: ChartRangeKey) {
  return useQuery<MarketChart>({
    queryKey: ['markets', 'chart', symbol, range],
    queryFn: () => apiFetch(`/markets/chart/${encodeURIComponent(symbol ?? '')}?range=${range}`),
    enabled: Boolean(symbol),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarketCompareCharts(symbols: string[], range: ChartRangeKey) {
  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ['markets', 'chart', symbol, range, 'compare'],
      queryFn: () => apiFetch<MarketChart>(`/markets/chart/${encodeURIComponent(symbol)}?range=${range}`),
      enabled: Boolean(symbol),
      refetchInterval: 60_000,
      staleTime: 30_000,
    })),
  })
}

export function useMarketQuote(symbol: string | null | undefined) {
  return useQuery<MarketQuoteDetail>({
    queryKey: ['markets', 'quote', symbol],
    queryFn: () => apiFetch(`/markets/quote/${encodeURIComponent(symbol ?? '')}`),
    enabled: Boolean(symbol),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarketHistory(
  symbol: string | null | undefined,
  params: { startDate: string; endDate: string; interval: HistoricalInterval },
) {
  return useQuery<MarketHistoryResponse>({
    queryKey: ['markets', 'history', symbol, params.startDate, params.endDate, params.interval],
    queryFn: () =>
      apiFetch(
        `/markets/history/${encodeURIComponent(symbol ?? '')}?startDate=${encodeURIComponent(params.startDate)}&endDate=${encodeURIComponent(params.endDate)}&interval=${params.interval}`,
      ),
    enabled: Boolean(symbol && params.startDate && params.endDate && params.startDate <= params.endDate),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarketInsight(symbol: string | null | undefined) {
  return useQuery<MarketInsightResponse>({
    queryKey: ['markets', 'insight', symbol],
    queryFn: () => apiFetch(`/markets/insight/${encodeURIComponent(symbol ?? '')}`),
    enabled: Boolean(symbol),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  })
}

export function useAiInsight(symbol: string | null | undefined, refreshSeconds?: number) {
  const interval = (refreshSeconds ?? 120) * 1000
  return useQuery<MarketInsightResponse>({
    queryKey: ['markets', 'ai-insight', symbol],
    queryFn: () => apiFetch(`/markets/ai-insight/${encodeURIComponent(symbol ?? '')}`),
    enabled: Boolean(symbol),
    refetchInterval: interval,
    staleTime: interval / 2,
  })
}

export function useAnalystFeed(symbol: string | null | undefined) {
  return useQuery<AnalystFeedResponse>({
    queryKey: ['markets', 'analyst-feed', symbol],
    queryFn: () => apiFetch(`/markets/analyst/${encodeURIComponent(symbol ?? '')}`),
    enabled: Boolean(symbol),
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  })
}

export function useMarketMovers() {
  return useQuery<MarketMoversResponse>({
    queryKey: ['markets', 'movers'],
    queryFn: () => apiFetch('/markets/movers'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useGlobalMarkets() {
  return useQuery<GlobalMarketAsset[]>({
    queryKey: ['markets', 'global'],
    queryFn: () => apiFetch('/markets/global'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function usePortfolio() {
  return useQuery<PortfolioResponse>({
    queryKey: ['markets', 'portfolio'],
    queryFn: () => apiFetch('/markets/portfolio'),
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

export function useAddPortfolioPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (position: PortfolioPositionInput) => apiPost('/markets/portfolio', position),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets', 'portfolio'] }),
  })
}

export function useUpdatePortfolioPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ symbol, position }: { symbol: string; position: PortfolioPositionInput }) =>
      apiPut(`/markets/portfolio/${encodeURIComponent(symbol)}`, position),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets', 'portfolio'] }),
  })
}

export function useRemovePortfolioPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) => apiDelete(`/markets/portfolio/${encodeURIComponent(symbol)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets', 'portfolio'] }),
  })
}

export function useSectorConstituents(etf: string | null | undefined) {
  return useQuery<SectorDetailResponse>({
    queryKey: ['markets', 'sector-constituents', etf],
    queryFn: () => apiFetch(`/markets/sectors/${encodeURIComponent(etf ?? '')}/constituents`),
    enabled: Boolean(etf),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  })
}

export function useScreener(filters: ScreenerFilters) {
  const params = new URLSearchParams()
  if (filters.sector) params.set('sector', filters.sector)
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.minChange !== undefined) params.set('minChange', String(filters.minChange))
  if (filters.maxChange !== undefined) params.set('maxChange', String(filters.maxChange))
  if (filters.minPe !== undefined) params.set('minPe', String(filters.minPe))
  if (filters.maxPe !== undefined) params.set('maxPe', String(filters.maxPe))
  if (filters.minVolume !== undefined) params.set('minVolume', String(filters.minVolume))
  if (filters.minMarketCap !== undefined) params.set('minMarketCap', String(filters.minMarketCap))
  if (filters.maxMarketCap !== undefined) params.set('maxMarketCap', String(filters.maxMarketCap))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  const queryString = params.toString()

  return useQuery<ScreenerResponse>({
    queryKey: ['markets', 'screener', queryString],
    queryFn: () => apiFetch(`/markets/screener${queryString ? `?${queryString}` : ''}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
