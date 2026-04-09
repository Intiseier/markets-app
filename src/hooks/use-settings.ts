import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPut } from '@/lib/api'
import type { MarketChartStyle } from '@/types/market'

export interface ApiKeyStatus {
  configured: boolean
  preview: string | null
}

export interface SettingsData {
  config: null
  mode: 'simple' | 'advanced'
  aiRefreshSeconds: number
  apiKeysStatus: {
    fmp: ApiKeyStatus
    twelvedata: ApiKeyStatus
    llmKey: ApiKeyStatus
    llmProvider: 'claude' | 'openai'
    newsApi: ApiKeyStatus
  }
  analystProvider: {
    primary: { provider: string; configured: boolean; preview: string | null }
    fallback: { provider: string; configured: boolean; preview: string | null }
  }
  marketPreferences: {
    chartStyle: MarketChartStyle
  }
  cronJobs: unknown[]
}

export function useSettings() {
  return useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/settings'),
    staleTime: 30_000,
  })
}

export function useSaveMarketPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (chartStyle: MarketChartStyle) => apiPut('/settings/market-preferences', { chartStyle }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useSaveApiKeys() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keys: {
      fmp?: string
      twelvedata?: string
      llmKey?: string
      llmProvider?: 'claude' | 'openai'
      newsApi?: string
    }) => apiPut('/settings/api-keys', keys),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useSaveMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: 'simple' | 'advanced') => apiPut('/settings/mode', { mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useSaveAiRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (aiRefreshSeconds: number) => apiPut('/settings/ai', { aiRefreshSeconds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useTestApiKey() {
  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      apiPost('/settings/test-key', { provider, key }),
  })
}
