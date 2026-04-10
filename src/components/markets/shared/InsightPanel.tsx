import { cn } from '@/lib/utils'
import type { MarketInsightResponse, StockDetailTab } from '@/types/market'
import {
  fmtCurrency,
  fmtSignedPercent,
  fmtCompactNumber,
  fmtPercent,
  formatDate,
  getToneClasses,
  toneLabel,
  getAlignmentClass,
} from './formatters'
import { StatItem } from './StatItem'
import { EmptyState } from './EmptyState'
import { NewsItem } from './NewsItem'

export function InsightPanel({
  symbol,
  insight,
  isLoading,
  onOpenTab,
}: {
  symbol: string
  insight?: MarketInsightResponse
  isLoading: boolean
  onOpenTab: (tab: StockDetailTab) => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Street Says + AI Take</div>
        {insight && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {insight.aiProviderLabel}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-100">Multi-horizon outlook</div>
          <div className="mt-1 text-sm text-zinc-500">
            Combines real headline tone with an AI read on momentum, volatility, and participation.
          </div>
        </div>

        {insight ? (
          <div className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider', getToneClasses(insight.overallTone))}>
            {toneLabel(insight.overallTone)}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
        </div>
      ) : insight ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Trust Notes</div>
              <div className="mt-3 space-y-2">
                {insight.trustNotes.map((note) => (
                  <div key={note} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Methodology</div>
              <div className="mt-3 space-y-2">
                {insight.methodology.map((step) => (
                  <div key={step} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Data Freshness</div>
              <div className="mt-3 space-y-3 text-sm text-zinc-300">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Market data: <span className="text-zinc-100">{formatDate(insight.dataFreshness.marketDataTime)}</span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Analyst feed: <span className="text-zinc-100">{formatDate(insight.dataFreshness.analystDataTime)}</span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  Headline count: <span className="text-zinc-100">{insight.dataFreshness.headlineCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Street Summary</div>
              <div className="mt-2 text-sm leading-6 text-zinc-200">{insight.streetSummary}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2 py-1">Positive: {insight.signals.positive}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Negative: {insight.signals.negative}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Analyst mentions: {insight.signals.analystMentions}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">Street rating: {insight.analystContext.rating ?? '--'}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Target drift: {fmtSignedPercent(insight.analystContext.upsidePercent)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-0.5 rounded-full bg-emerald-500" />
                <div className="text-xs uppercase tracking-wider text-zinc-500">{insight.aiProviderLabel ?? 'MehAI says\u2026'}</div>
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-300">{insight.aiSummary}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Support: {fmtCurrency(insight.keyLevels.support)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Resistance: {fmtCurrency(insight.keyLevels.resistance)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Avg Volume: {fmtCompactNumber(insight.keyLevels.averageVolume)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  Upgrades / Downgrades: {insight.analystContext.upgrades}/{insight.analystContext.downgrades}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {insight.horizons.map((horizon) => (
              <div key={horizon.key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{horizon.label}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                      Conviction {horizon.conviction}
                    </div>
                  </div>
                  <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getToneClasses(horizon.tone))}>
                    {toneLabel(horizon.tone)}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
                      <span>Confidence</span>
                      <span>{horizon.confidenceScore}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          horizon.confidenceScore >= 70
                            ? 'bg-emerald-400'
                            : horizon.confidenceScore >= 55
                              ? 'bg-amber-300'
                              : 'bg-red-400',
                        )}
                        style={{ width: `${horizon.confidenceScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getAlignmentClass(horizon.analystAlignment))}>
                      Analyst Alignment: {horizon.analystAlignment}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Conviction: {horizon.conviction}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatItem label="Return" value={fmtSignedPercent(horizon.priceChangePercent)} />
                  <StatItem label="Volatility" value={fmtPercent(horizon.volatilityPercent)} />
                  <StatItem label="Volume Shift" value={fmtSignedPercent(horizon.volumeTrendPercent)} />
                  <StatItem
                    label="Levels"
                    value={
                      horizon.support !== null && horizon.resistance !== null
                        ? `${fmtCurrency(horizon.support)} / ${fmtCurrency(horizon.resistance)}`
                        : '--'
                    }
                  />
                </div>

                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Street</div>
                    <p className="mt-1">{horizon.streetView}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">AI Take</div>
                    <p className="mt-1">{horizon.aiView}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Why This View</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {horizon.drivers.map((driver) => (
                      <span key={driver} className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300">
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Inspect Inputs</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTab('overview')}
                      className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      Open Price Structure
                    </button>
                    {(Math.abs(horizon.scoreBreakdown.analystTarget) > 0 ||
                      Math.abs(horizon.scoreBreakdown.analystRating) > 0 ||
                      Math.abs(horizon.scoreBreakdown.analystActions) > 0) ? (
                      <button
                        type="button"
                        onClick={() => onOpenTab('analyst')}
                        className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                      >
                        Open Analyst Feed
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenTab('history')}
                      className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      Open History Table
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Score Breakdown</div>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <table className="min-w-full text-xs">
                      <tbody>
                        {[
                          ['Price Trend', horizon.scoreBreakdown.priceTrend],
                          ['Volume Trend', horizon.scoreBreakdown.volumeTrend],
                          ['Headline Tone', horizon.scoreBreakdown.headlineTone],
                          ['Analyst Target', horizon.scoreBreakdown.analystTarget],
                          ['Analyst Rating', horizon.scoreBreakdown.analystRating],
                          ['Analyst Actions', horizon.scoreBreakdown.analystActions],
                          ['Volatility Penalty', horizon.scoreBreakdown.volatilityPenalty],
                          ['Data Depth Adj.', horizon.scoreBreakdown.dataDepthAdjustment],
                          ['Alignment Adj.', horizon.scoreBreakdown.analystAlignmentAdjustment],
                          ['Raw Composite', horizon.scoreBreakdown.rawComposite],
                        ].map(([label, value]) => {
                          const numericValue = Number(value)
                          return (
                            <tr key={String(label)} className="border-b border-zinc-800/60 last:border-b-0">
                              <td className="px-3 py-2 text-zinc-400">{label}</td>
                              <td
                                className={cn(
                                  'px-3 py-2 text-right font-medium tabular-nums',
                                  numericValue > 0 ? 'text-emerald-400' : numericValue < 0 ? 'text-red-300' : 'text-zinc-300',
                                )}
                              >
                                {numericValue >= 0 ? '+' : ''}
                                {numericValue.toFixed(3)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Risk Flags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {horizon.risks.map((risk) => (
                      <span key={risk} className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-200">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent {symbol} headlines</div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
              {insight.headlines.length > 0 ? (
                <div className="flex flex-col divide-y divide-zinc-800/60">
                  {insight.headlines.map((item) => (
                    <NewsItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState title="No recent headlines" detail={`Fresh coverage for ${symbol} is thin right now.`} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No market outlook yet" detail={`The intelligence layer for ${symbol} is unavailable right now.`} />
        </div>
      )}
    </div>
  )
}
