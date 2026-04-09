import { useState } from 'react'
import { Check, X, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { useSettings, useSaveApiKeys, useSaveMode, useSaveMarketPreferences, useSaveAiRefresh, useTestApiKey } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

type LlmProvider = 'claude' | 'openai'

interface KeyRowProps {
  label: string
  provider: string
  configured: boolean
  preview: string | null
  onSave: (key: string) => void
  onTest?: (key: string) => Promise<{ ok: boolean; message: string }>
  placeholder?: string
}

function KeyRow({ label, provider, configured, preview, onSave, onTest, placeholder }: KeyRowProps) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleTest() {
    if (!value.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest!(value.trim())
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, message: 'Test failed. Check your network.' })
    } finally {
      setTesting(false)
    }
  }

  function handleSave() {
    onSave(value.trim())
    setValue('')
    setTestResult(null)
  }

  function handleClear() {
    onSave('')
    setValue('')
    setTestResult(null)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-200">{label}</div>
          {configured ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-400">
              <Check size={11} />
              Configured {preview && <span className="text-zinc-500">({preview})</span>}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-zinc-600">Not configured</div>
          )}
        </div>
        {configured && (
          <button type="button" onClick={handleClear} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
            Clear
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder ?? 'Paste your API key...'}
            className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={!value.trim() || testing}
            className="rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!value.trim()}
          className="rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {testResult && (
        <div className={cn('mt-2 flex items-center gap-1.5 text-xs', testResult.ok ? 'text-emerald-400' : 'text-red-400')}>
          {testResult.ok ? <Check size={11} /> : <X size={11} />}
          {testResult.message}
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const saveApiKeys = useSaveApiKeys()
  const saveMode = useSaveMode()
  const savePreferences = useSaveMarketPreferences()
  const saveAiRefresh = useSaveAiRefresh()
  const testKey = useTestApiKey()

  const [llmProvider, setLlmProvider] = useState<LlmProvider>('claude')
  const [aiRefresh, setAiRefresh] = useState(settings?.aiRefreshSeconds ?? 120)

  const isAdvanced = settings?.mode === 'advanced'

  async function doTestKey(provider: string, key: string) {
    const result = await testKey.mutateAsync({ provider, key })
    return result as { ok: boolean; message: string }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl">
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">MarketMeh</div>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Settings</h1>
      </div>

      {/* --- Mode --- */}
      <section>
        <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Mode</div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-zinc-200">{isAdvanced ? 'Advanced Mode' : 'Simple Mode'}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {isAdvanced
                  ? 'Showing score breakdowns, screener, history tab, and sub-industry data.'
                  : 'Showing clean at-a-glance view. Toggle to unlock screener and advanced overlays.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveMode.mutate(isAdvanced ? 'simple' : 'advanced')}
              className={cn(
                'relative h-7 w-12 flex-shrink-0 rounded-full transition-colors',
                isAdvanced ? 'bg-emerald-600' : 'bg-zinc-700',
              )}
            >
              <span className={cn(
                'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                isAdvanced ? 'left-6' : 'left-1',
              )} />
            </button>
          </div>
        </div>
      </section>

      {/* --- API Keys --- */}
      <section>
        <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">API Keys</div>
        <div className="space-y-3">
          <KeyRow
            label="Financial Modeling Prep"
            provider="fmp"
            configured={settings?.apiKeysStatus.fmp.configured ?? false}
            preview={settings?.apiKeysStatus.fmp.preview ?? null}
            onSave={(key) => saveApiKeys.mutate({ fmp: key })}
            onTest={(key) => doTestKey('fmp', key)}
            placeholder="Your FMP API key…"
          />
          <KeyRow
            label="TwelveData"
            provider="twelvedata"
            configured={settings?.apiKeysStatus.twelvedata.configured ?? false}
            preview={settings?.apiKeysStatus.twelvedata.preview ?? null}
            onSave={(key) => saveApiKeys.mutate({ twelvedata: key })}
            onTest={(key) => doTestKey('twelvedata', key)}
            placeholder="Your TwelveData API key…"
          />

          {/* LLM provider picker + key */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-200">AI Provider (LLM)</div>
                {settings?.apiKeysStatus.llmKey.configured ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check size={11} />
                    {settings.apiKeysStatus.llmProvider === 'openai' ? 'OpenAI configured' : 'Claude configured'}
                    {settings.apiKeysStatus.llmKey.preview && <span className="text-zinc-500">({settings.apiKeysStatus.llmKey.preview})</span>}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-zinc-600">Not configured — showing MehAI (deterministic)</div>
                )}
              </div>
            </div>

            {/* Provider radio */}
            <div className="mt-3 flex gap-4">
              {(['claude', 'openai'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="llm-provider"
                    value={p}
                    checked={llmProvider === p}
                    onChange={() => setLlmProvider(p)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-zinc-300">{p === 'claude' ? 'Anthropic (Claude)' : 'OpenAI (ChatGPT)'}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <LlmKeyInput
                  llmProvider={llmProvider}
                  onSave={(key) => saveApiKeys.mutate({ llmKey: key, llmProvider })}
                  onTest={(key) => doTestKey(llmProvider, key)}
                />
              </div>
            </div>
          </div>

          <KeyRow
            label="News API"
            provider="newsapi"
            configured={settings?.apiKeysStatus.newsApi.configured ?? false}
            preview={settings?.apiKeysStatus.newsApi.preview ?? null}
            onSave={(key) => saveApiKeys.mutate({ newsApi: key })}
            onTest={(key) => doTestKey('newsapi', key)}
            placeholder="Your NewsAPI.org key…"
          />
        </div>
      </section>

      {/* --- Preferences --- */}
      <section>
        <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Preferences</div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5">
          {/* Chart style */}
          <div>
            <div className="text-sm font-medium text-zinc-200 mb-2">Default Chart Style</div>
            <div className="flex gap-2">
              {(['area', 'line', 'candles'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => savePreferences.mutate(style)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors',
                    settings?.marketPreferences.chartStyle === style
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* AI refresh interval */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-zinc-200">AI Refresh Interval</div>
              <div className="text-sm tabular-nums text-zinc-400">{aiRefresh}s</div>
            </div>
            <input
              type="range"
              min={30}
              max={600}
              step={30}
              value={aiRefresh}
              onChange={(e) => setAiRefresh(Number(e.target.value))}
              onMouseUp={() => saveAiRefresh.mutate(aiRefresh)}
              onTouchEnd={() => saveAiRefresh.mutate(aiRefresh)}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>30s</span>
              <span>10min</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Extracted to avoid re-render loops with llmProvider state
function LlmKeyInput({
  llmProvider,
  onSave,
  onTest,
}: {
  llmProvider: LlmProvider
  onSave: (key: string) => void
  onTest: (key: string) => Promise<{ ok: boolean; message: string }>
}) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const placeholder = llmProvider === 'claude' ? 'sk-ant-…' : 'sk-…'

  async function handleTest() {
    if (!value.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(value.trim())
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, message: 'Test failed.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button type="button" onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button type="button" onClick={handleTest} disabled={!value.trim() || testing}
          className="rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button type="button" onClick={() => { onSave(value.trim()); setValue(''); setTestResult(null) }} disabled={!value.trim()}
          className="rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {testResult && (
        <div className={cn('flex items-center gap-1.5 text-xs', testResult.ok ? 'text-emerald-400' : 'text-red-400')}>
          {testResult.ok ? <Check size={11} /> : <X size={11} />}
          {testResult.message}
        </div>
      )}
    </div>
  )
}
