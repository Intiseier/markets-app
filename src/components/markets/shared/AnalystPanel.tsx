import { cn } from '@/lib/utils'
import type { AnalystFeedResponse } from '@/types/market'
import {
  fmtCurrency,
  fmtSignedPercent,
  getAnalystRatingClass,
  getUpsideTone,
} from './formatters'
import { StatItem } from './StatItem'
import { EmptyState } from './EmptyState'
import { AnalystActionTable } from './AnalystActionTable'
import { buildLinePath } from './chart-utils'

export function AnalystPanel({
  symbol,
  analystFeed,
  isLoading,
  hasError = false,
}: {
  symbol: string
  analystFeed?: AnalystFeedResponse
  isLoading: boolean
  hasError?: boolean
}) {
  const consensus = analystFeed?.gradesConsensus
  const targetConsensus = analystFeed?.priceTargetConsensus
  const hasAnalystCoverage = Boolean(
    targetConsensus ||
    (analystFeed?.priceTargetSummary.length ?? 0) > 0 ||
    consensus?.rating ||
    (analystFeed?.latestActions.length ?? 0) > 0 ||
    (analystFeed?.historicalActions.length ?? 0) > 0,
  )
  const totalRatings =
    (consensus?.strongBuy ?? 0) +
    (consensus?.buy ?? 0) +
    (consensus?.hold ?? 0) +
    (consensus?.sell ?? 0) +
    (consensus?.strongSell ?? 0)
  const upsideTone = getUpsideTone(targetConsensus?.upsidePercent)
  const actionCounts = {
    upgrades: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('upgrade')).length ?? 0,
    downgrades: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('downgrade')).length ?? 0,
    maintains: analystFeed?.latestActions.filter((item) => {
      const action = (item.action ?? '').toLowerCase()
      return action.includes('maintain') || action.includes('reiterate')
    }).length ?? 0,
    initiations: analystFeed?.latestActions.filter((item) => (item.action ?? '').toLowerCase().includes('init')).length ?? 0,
  }
  const ratingBars = [
    { label: 'Strong Buy', value: consensus?.strongBuy ?? 0, className: 'bg-emerald-400' },
    { label: 'Buy', value: consensus?.buy ?? 0, className: 'bg-emerald-300' },
    { label: 'Hold', value: consensus?.hold ?? 0, className: 'bg-zinc-400' },
    { label: 'Sell', value: consensus?.sell ?? 0, className: 'bg-amber-300' },
    { label: 'Strong Sell', value: consensus?.strongSell ?? 0, className: 'bg-red-400' },
  ]
  const revisionPoints = (analystFeed?.targetRevision ?? []).filter((p) => p.value !== null)
  const revisionValues = revisionPoints.map((p) => p.value ?? 0)
  const revisionMin = revisionValues.length > 0 ? Math.min(...revisionValues) : 0
  const revisionMax = revisionValues.length > 0 ? Math.max(...revisionValues) : 0
  const revisionPath = revisionPoints.length > 1 ? buildLinePath(revisionValues, revisionMax, revisionMin) : ''
  const currentTargetValue = targetConsensus?.consensus ?? revisionPoints[revisionPoints.length - 1]?.value ?? null
  const providerLimitNote = analystFeed?.note?.toLowerCase().includes('rate-limit') || analystFeed?.note?.toLowerCase().includes('plan has reached')
  const providerRejectedNote = analystFeed?.note?.toLowerCase().includes('rejected the saved api key')

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Dedicated Analyst Feed</div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">Consensus targets, upgrades, downgrades</div>
          <div className="mt-1 text-sm text-zinc-500">
            This uses a dedicated analyst-data provider instead of inferring sentiment from headlines alone.
          </div>
        </div>
        {analystFeed?.configured ? (
          <div className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1 text-xs uppercase tracking-wider text-zinc-300">
            {analystFeed.provider}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-950/70" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-zinc-950/70" />
        </div>
      ) : hasError ? (
        <div className="mt-4">
          <EmptyState
            title="Analyst feed unavailable"
            detail={`The analyst provider request for ${symbol} failed. Try refresh; if it keeps happening, the provider may be throttling.`}
          />
        </div>
      ) : analystFeed?.configured ? (
        hasAnalystCoverage ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Consensus Target</div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <div className="text-4xl font-semibold tabular-nums text-zinc-50">{fmtCurrency(targetConsensus?.consensus)}</div>
                      <div
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
                          upsideTone === 'positive' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                          upsideTone === 'negative' && 'border-red-500/30 bg-red-500/10 text-red-300',
                          upsideTone === 'neutral' && 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
                        )}
                      >
                        {fmtSignedPercent(targetConsensus?.upsidePercent)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-zinc-500">
                      Current {fmtCurrency(analystFeed.currentPrice)} | Median {fmtCurrency(targetConsensus?.median)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatItem label="Target High" value={fmtCurrency(targetConsensus?.high)} />
                    <StatItem label="Target Low" value={fmtCurrency(targetConsensus?.low)} />
                    <StatItem label="Analysts" value={targetConsensus?.analystCount !== null ? String(targetConsensus?.analystCount) : '--'} />
                    <StatItem label="Street Rating" value={consensus?.rating ?? '--'} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatItem label="Upgrades" value={String(actionCounts.upgrades)} />
                <StatItem label="Downgrades" value={String(actionCounts.downgrades)} />
                <StatItem label="Maintains" value={String(actionCounts.maintains)} />
                <StatItem label="Initiations" value={String(actionCounts.initiations)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Consensus Breakdown</div>
                  <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', getAnalystRatingClass(consensus?.rating))}>
                    {consensus?.rating ?? '--'}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {ratingBars.map((bar) => {
                    const width = totalRatings > 0 ? (bar.value / totalRatings) * 100 : 0
                    return (
                      <div key={bar.label}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-300">{bar.label}</span>
                          <span className="tabular-nums text-zinc-500">
                            {bar.value}{totalRatings > 0 ? ` | ${((bar.value / totalRatings) * 100).toFixed(0)}%` : ''}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-800">
                          <div className={cn('h-2 rounded-full', bar.className)} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatItem label="Strong Buy" value={String(consensus?.strongBuy ?? '--')} />
                  <StatItem label="Buy" value={String(consensus?.buy ?? '--')} />
                  <StatItem label="Hold" value={String(consensus?.hold ?? '--')} />
                  <StatItem label="Sell" value={String(consensus?.sell ?? '--')} />
                  <StatItem label="Strong Sell" value={String(consensus?.strongSell ?? '--')} />
                  <StatItem label="Ratings Count" value={totalRatings > 0 ? String(totalRatings) : '--'} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Price Target Windows</div>
                <div className="mt-3 space-y-2">
                  {analystFeed.priceTargetSummary.length > 0 ? (
                    analystFeed.priceTargetSummary.map((window) => (
                      <div key={window.label} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-100">{window.label}</div>
                          <div className="text-xs text-zinc-500">
                            {window.analystCount !== null ? `${window.analystCount} analysts` : 'Analyst count unavailable'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular-nums text-zinc-100">
                            {window.analystCount === 0 ? '--' : fmtCurrency(window.consensus)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {window.analystCount !== 0 && targetConsensus?.consensus != null && window.consensus != null
                              ? `${fmtSignedPercent(((window.consensus - targetConsensus.consensus) / targetConsensus.consensus) * 100)} vs current`
                              : '--'}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No target windows" detail={`The provider did not return target windows for ${symbol}.`} />
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Target Revision Snapshot</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Shows how the provider's target windows stack up against the current consensus target.
                  </div>
                </div>
                <div className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs uppercase tracking-wider text-zinc-300">
                  Current consensus {fmtCurrency(currentTargetValue)}
                </div>
              </div>

              {revisionPoints.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {revisionPoints.length > 1 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="h-24">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                          <path d={revisionPath} fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>Lowest window {fmtCurrency(revisionMin)}</span>
                        <span>Highest window {fmtCurrency(revisionMax)}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {revisionPoints.map((point) => {
                      const deltaPercent =
                        currentTargetValue !== null && point.value !== null && currentTargetValue !== 0
                          ? ((point.value - currentTargetValue) / currentTargetValue) * 100
                          : null
                      return (
                        <div key={point.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                          <div className="text-xs uppercase tracking-wider text-zinc-500">{point.label}</div>
                          <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{fmtCurrency(point.value)}</div>
                          <div className="mt-2 text-xs text-zinc-500">
                            {point.analystCount !== null ? `${point.analystCount} analysts` : 'Analyst count unavailable'}
                          </div>
                          <div
                            className={cn(
                              'mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                              deltaPercent !== null && deltaPercent > 0 && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                              deltaPercent !== null && deltaPercent < 0 && 'border-red-500/30 bg-red-500/10 text-red-300',
                              (deltaPercent === null || deltaPercent === 0) && 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
                            )}
                          >
                            {deltaPercent === null ? '--' : `${fmtSignedPercent(deltaPercent)} vs current`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState title="No revision snapshot" detail={`The provider did not return target-window history for ${symbol}.`} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AnalystActionTable title="Latest Analyst Actions" items={analystFeed.latestActions} />
              <AnalystActionTable
                title="Historical Analyst Actions"
                items={analystFeed.historicalActions.filter((item) => item.firm || item.action || item.newGrade)}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={
                providerLimitNote
                  ? 'Analyst provider limit reached'
                  : providerRejectedNote
                    ? 'Analyst provider rejected the key'
                    : 'No analyst coverage for this symbol'
              }
              detail={analystFeed.note ?? `The provider is connected, but it did not return analyst targets or rating actions for ${symbol}.`}
            />
          </div>
        )
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Analyst feed not configured"
            detail={analystFeed?.note ?? 'Add an analyst-data API key in Settings to enable consensus targets and grade changes.'}
          />
        </div>
      )}
    </div>
  )
}
