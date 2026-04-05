import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPut } from '@/lib/api'

import type { MarketChartStyle } from '@/types/market'

interface SettingsData {
  config: null
  analystProvider: {
    primary: {
      provider: string
      configured: boolean
      apiKeyPreview: string | null
    }
    fallback: {
      provider: string
      configured: boolean
      apiKeyPreview: string | null
    }
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
  })
}

export function useSaveMarketPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (chartStyle: MarketChartStyle) => apiPut('/settings/market-preferences', { chartStyle }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
