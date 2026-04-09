import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { readSettings, getApiKey } from './settings-store.js'
import type { MarketInsightResponse } from '../../src/types/market.js'

export type AiProvider = 'claude' | 'openai' | 'fallback'

export function detectAiProvider(): AiProvider {
  const settings = readSettings()
  const provider = settings.apiKeys.llmProvider ?? 'claude'
  const key = getApiKey('llmKey')
  if (!key) return 'fallback'
  return provider
}

export function aiProviderLabel(provider: AiProvider): string {
  if (provider === 'claude') return 'Claude says\u2026'
  if (provider === 'openai') return 'ChatGPT says\u2026'
  return 'MehAI says\u2026'
}

export function buildAiPrompt(
  symbol: string,
  name: string,
  insight: Pick<MarketInsightResponse, 'signals' | 'analystContext' | 'horizons' | 'keyLevels' | 'overallTone'>,
  currentPrice: number | null,
  changePercent: number | null,
): string {
  const horizonSummary = insight.horizons
    .map((h) => `${h.label}: ${h.tone} (return ${h.priceChangePercent.toFixed(1)}%, vol ${h.volatilityPercent.toFixed(1)}%)`)
    .join('; ')

  return `You are MehAI, a sharp but slightly-apathetic markets analyst for the MarketMeh app.
Tone: dry, casual, specific to the numbers — never hyped, no disclaimers, no emojis.

Write EXACTLY 3 short paragraphs (2-3 sentences each), in this order:
1. The Street take — what analyst consensus and headlines suggest
2. The structural take — what price/volume/levels actually show
3. The vibe check — one sentence verdict: bullish-ish / bearish-ish / meh

MARKET DATA:
Symbol: ${symbol} (${name})
Price: ${currentPrice?.toFixed(2) ?? '--'} | Day change: ${changePercent?.toFixed(2) ?? '--'}%
Overall tone: ${insight.overallTone}
Headlines: ${insight.signals.positive} positive, ${insight.signals.negative} negative, ${insight.signals.neutral} neutral
Analyst rating: ${insight.analystContext.rating ?? 'no coverage'} | Upside: ${insight.analystContext.upsidePercent?.toFixed(1) ?? '--'}%
Analyst target: ${insight.analystContext.targetConsensus?.toFixed(2) ?? '--'} | Upgrades/Downgrades: ${insight.analystContext.upgrades}/${insight.analystContext.downgrades}
Support: ${insight.keyLevels.support?.toFixed(2) ?? '--'} | Resistance: ${insight.keyLevels.resistance?.toFixed(2) ?? '--'}
Horizons: ${horizonSummary}

Keep it under 180 words total. Be specific. Don't repeat the symbol name every sentence.`
}

// Per-symbol cache: { t: timestamp, provider, label, text }
const aiCache = new Map<string, { t: number; provider: AiProvider; label: string; text: string }>()

export function getCachedAiInsight(symbol: string, ttlSeconds: number) {
  const cached = aiCache.get(symbol)
  if (cached && Date.now() - cached.t < ttlSeconds * 1000) return cached
  return null
}

export function setCachedAiInsight(symbol: string, provider: AiProvider, label: string, text: string) {
  aiCache.set(symbol, { t: Date.now(), provider, label, text })
}

export async function generateAiInsight(prompt: string): Promise<string | null> {
  const provider = detectAiProvider()
  if (provider === 'fallback') return null

  const key = getApiKey('llmKey')
  if (!key) return null

  try {
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey: key })
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })
      return res.content[0].type === 'text' ? res.content[0].text.trim() : null
    }

    if (provider === 'openai') {
      const client = new OpenAI({ apiKey: key })
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })
      return res.choices[0].message.content?.trim() ?? null
    }
  } catch (e) {
    console.error(`[AI provider ${provider}] error:`, e instanceof Error ? e.message : e)
  }

  return null
}
