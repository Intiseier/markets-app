import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) } catch { return process.cwd() }
})()
const DATA_DIR = process.env.MARKETS_DATA_DIR ?? path.join(__dirname, '..', 'data')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

export interface ApiKeys {
  fmp?: string
  twelvedata?: string
  llmProvider?: 'claude' | 'openai'
  llmKey?: string
  newsApi?: string
}

export interface AppSettings {
  marketPreferences: {
    chartStyle: 'area' | 'line' | 'candles'
    defaultSma20: boolean
    defaultSma50: boolean
    defaultVolume: boolean
  }
  apiKeys: ApiKeys
  mode: 'simple' | 'advanced'
  aiRefreshSeconds: number
}

const DEFAULTS: AppSettings = {
  marketPreferences: { chartStyle: 'area', defaultSma20: true, defaultSma50: true, defaultVolume: true },
  apiKeys: {},
  mode: 'simple',
  aiRefreshSeconds: 120,
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function readSettings(): AppSettings {
  ensureDataDir()
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...parsed,
      apiKeys: { ...(parsed.apiKeys ?? {}) },
      marketPreferences: { ...DEFAULTS.marketPreferences, ...(parsed.marketPreferences ?? {}) },
    }
  } catch {
    return { ...DEFAULTS, apiKeys: {} }
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  ensureDataDir()
  const current = readSettings()
  const next: AppSettings = {
    ...current,
    ...patch,
    // Deep merge nested objects
    apiKeys: { ...current.apiKeys, ...(patch.apiKeys ?? {}) },
    marketPreferences: { ...current.marketPreferences, ...(patch.marketPreferences ?? {}) },
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

/**
 * Get an API key — reads from settings first, then falls back to env vars.
 * Never returns an empty string (returns undefined instead so callers can use ?? '').
 */
export function getApiKey(name: keyof ApiKeys): string | undefined {
  const settings = readSettings()
  const fromStore = settings.apiKeys[name]
  if (fromStore && typeof fromStore === 'string' && fromStore.trim()) return fromStore.trim()

  // Env var fallbacks
  const envMap: Partial<Record<keyof ApiKeys, string[]>> = {
    fmp: ['FMP_API_KEY', 'FINANCIAL_MODELING_PREP_API_KEY'],
    twelvedata: ['TWELVEDATA_API_KEY'],
    llmKey: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    newsApi: ['NEWS_API_KEY', 'NEWSAPI_KEY'],
  }
  for (const envName of envMap[name] ?? []) {
    const val = process.env[envName]
    if (val?.trim()) return val.trim()
  }
  return undefined
}

/**
 * Returns provider label string for display (never reveals the key itself).
 */
export function getApiKeyStatus(name: keyof ApiKeys): { configured: boolean; preview: string | null } {
  const settings = readSettings()
  const fromStore = settings.apiKeys[name]
  if (fromStore && typeof fromStore === 'string' && fromStore.trim()) {
    const trimmed = fromStore.trim()
    return { configured: true, preview: trimmed.length > 4 ? `...${trimmed.slice(-4)}` : '****' }
  }

  const envMap: Partial<Record<keyof ApiKeys, string[]>> = {
    fmp: ['FMP_API_KEY', 'FINANCIAL_MODELING_PREP_API_KEY'],
    twelvedata: ['TWELVEDATA_API_KEY'],
    llmKey: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    newsApi: ['NEWS_API_KEY', 'NEWSAPI_KEY'],
  }
  for (const envName of envMap[name] ?? []) {
    const val = process.env[envName]
    if (val?.trim()) {
      return { configured: true, preview: '(from env)' }
    }
  }
  return { configured: false, preview: null }
}
