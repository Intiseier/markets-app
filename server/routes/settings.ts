import { Router } from 'express'
import { readSettings, writeSettings, getApiKeyStatus } from '../lib/settings-store.js'

const router = Router()

router.get('/', (_req, res) => {
  const settings = readSettings()
  res.json({
    marketPreferences: settings.marketPreferences,
    mode: settings.mode,
    aiRefreshSeconds: settings.aiRefreshSeconds,
    apiKeysStatus: {
      fmp: getApiKeyStatus('fmp'),
      twelvedata: getApiKeyStatus('twelvedata'),
      llmKey: getApiKeyStatus('llmKey'),
      llmProvider: settings.apiKeys.llmProvider ?? 'claude',
      newsApi: getApiKeyStatus('newsApi'),
    },
    // Legacy compat — some frontend code may read these
    config: null,
    analystProvider: {
      primary: { provider: 'Financial Modeling Prep', ...getApiKeyStatus('fmp') },
      fallback: { provider: 'Twelve Data', ...getApiKeyStatus('twelvedata') },
    },
    cronJobs: [],
  })
})

router.put('/api-keys', (req, res) => {
  const { fmp, twelvedata, llmKey, llmProvider, newsApi } = req.body as {
    fmp?: string
    twelvedata?: string
    llmKey?: string
    llmProvider?: 'claude' | 'openai'
    newsApi?: string
  }

  const patch: Record<string, string | undefined> = {}
  if (fmp !== undefined) patch.fmp = fmp || undefined
  if (twelvedata !== undefined) patch.twelvedata = twelvedata || undefined
  if (llmKey !== undefined) patch.llmKey = llmKey || undefined
  if (newsApi !== undefined) patch.newsApi = newsApi || undefined

  const providerPatch: { llmProvider?: 'claude' | 'openai' } = {}
  if (llmProvider === 'claude' || llmProvider === 'openai') providerPatch.llmProvider = llmProvider

  writeSettings({ apiKeys: { ...patch, ...providerPatch } as any })
  res.json({ ok: true })
})

router.put('/market-preferences', (req, res) => {
  const { chartStyle } = req.body as { chartStyle?: string }
  writeSettings({ marketPreferences: { chartStyle: (chartStyle as any) ?? 'area' } })
  res.json({ ok: true })
})

router.put('/mode', (req, res) => {
  const { mode } = req.body as { mode?: 'simple' | 'advanced' }
  if (mode !== 'simple' && mode !== 'advanced') {
    return res.status(400).json({ error: 'mode must be "simple" or "advanced"' })
  }
  writeSettings({ mode })
  return res.json({ ok: true })
})

router.put('/ai', (req, res) => {
  const { aiRefreshSeconds } = req.body as { aiRefreshSeconds?: number }
  const seconds = Number(aiRefreshSeconds)
  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 600) {
    return res.status(400).json({ error: 'aiRefreshSeconds must be between 30 and 600' })
  }
  writeSettings({ aiRefreshSeconds: seconds })
  return res.json({ ok: true })
})

router.post('/test-key', async (req, res) => {
  const { provider, key } = req.body as { provider?: string; key?: string }
  if (!key?.trim()) return res.status(400).json({ ok: false, message: 'No key provided' })

  try {
    if (provider === 'fmp') {
      const url = `https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${encodeURIComponent(key)}`
      const r = await fetch(url)
      const data: any = await r.json()
      if (Array.isArray(data) && data.length > 0) return res.json({ ok: true, message: 'FMP key is valid' })
      return res.json({ ok: false, message: 'FMP key invalid or limit exceeded' })
    }

    if (provider === 'twelvedata') {
      const url = `https://api.twelvedata.com/api_usage?apikey=${encodeURIComponent(key)}`
      const r = await fetch(url)
      const data: any = await r.json()
      if (data?.data) return res.json({ ok: true, message: 'TwelveData key is valid' })
      return res.json({ ok: false, message: 'TwelveData key invalid' })
    }

    if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      })
      if (r.ok) return res.json({ ok: true, message: 'Anthropic key is valid' })
      return res.json({ ok: false, message: `Anthropic key invalid (${r.status})` })
    }

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (r.ok) return res.json({ ok: true, message: 'OpenAI key is valid' })
      return res.json({ ok: false, message: `OpenAI key invalid (${r.status})` })
    }

    if (provider === 'newsapi') {
      const r = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${encodeURIComponent(key)}`)
      const data: any = await r.json()
      if (data?.status === 'ok') return res.json({ ok: true, message: 'NewsAPI key is valid' })
      return res.json({ ok: false, message: data?.message ?? 'NewsAPI key invalid' })
    }

    return res.status(400).json({ ok: false, message: `Unknown provider: ${provider}` })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: `Test failed: ${e?.message ?? 'unknown error'}` })
  }
})

export default router
