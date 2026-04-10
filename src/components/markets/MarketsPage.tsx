import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowLeft, Plus, X } from 'lucide-react'
import {
  useAddToWatchlist,
  useAiInsight,
  useAnalystFeed,
  useGlobalMarkets,
  useMarketChart,
  useMarketCompareCharts,
  useMarketHistory,
  useMarketIndices,
  useMarketMovers,
  useMarketNews,
  useMarketQuote,
  useMarketSectors,
  useRemoveFromWatchlist,
  useWatchlist,
} from '@/hooks/use-markets'
import { useSettings } from '@/hooks/use-settings'
import type { ChartRangeKey, HistoricalInterval, MarketChart, StockDetailTab } from '@/types/market'
import { cn } from '@/lib/utils'
import {
  fmtCurrency,
  fmtPrice,
  fmtPercent,
  fmtChange,
  fmtSignedPercent,
  formatRawNumber,
  getTodayDate,
  getDateDaysAgo,
} from './shared/formatters'
import { ChartPanel } from './shared/ChartPanel'
import { QuotePanel } from './shared/QuotePanel'
import { HistoryPanel } from './shared/HistoryPanel'
import { AnalystPanel } from './shared/AnalystPanel'
import { InsightPanel } from './shared/InsightPanel'
import { IndexCard } from './shared/IndexCard'
import { StockCard } from './shared/StockCard'
import { SectorCard } from './shared/SectorCard'
import { NewsItem } from './shared/NewsItem'
import { MoversList } from './shared/MoversList'
import { GlobalAssetCard } from './shared/GlobalAssetCard'
import { SummaryCard } from './shared/SummaryCard'
import { StatItem } from './shared/StatItem'

const BENCHMARK_COMPARE_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA']
const SECTOR_COMPARE_SYMBOLS: Record<string, string> = {
  'Communication Services': 'XLC',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  Energy: 'XLE',
  Financial: 'XLF',
  Financials: 'XLF',
  Healthcare: 'XLV',
  Industrials: 'XLI',
  'Basic Materials': 'XLB',
  Materials: 'XLB',
  'Real Estate': 'XLRE',
  Technology: 'XLK',
  Utilities: 'XLU',
}

function createDefaultHistoryRange() {
  return {
    startDate: getDateDaysAgo(90),
    endDate: getTodayDate(),
  }
}

function getComparePresets(
  selectedSymbol: string | null,
  sector: string | null | undefined,
  compareSymbols: string[],
) {
  if (!selectedSymbol) return []
  const sectorSymbol = sector ? SECTOR_COMPARE_SYMBOLS[sector] : undefined
  return [sectorSymbol, ...BENCHMARK_COMPARE_SYMBOLS]
    .filter((symbol): symbol is string => Boolean(symbol))
    .filter((symbol, index, array) => array.indexOf(symbol) === index)
    .filter((symbol) => symbol !== selectedSymbol && !compareSymbols.includes(symbol))
}

function getGlobalCategory(symbol: string) {
  if (symbol.endsWith('-USD')) return 'Crypto'
  if (symbol.includes('=F') && symbol.startsWith('EUR')) return 'Forex'
  return 'Commodities'
}

export function MarketsPage() {
  const settingsQuery = useSettings()
  const defaultHistoryRange = createDefaultHistoryRange()
  const [tickerInput, setTickerInput] = useState('')
  const [workspaceSymbolInput, setWorkspaceSymbolInput] = useState('')
  const [compareSymbolInput, setCompareSymbolInput] = useState('')
  const [compareSymbols, setCompareSymbols] = useState<string[]>([])
  const [addError, setAddError] = useState('')
  const [compareError, setCompareError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<StockDetailTab>('overview')
  const [selectedRange, setSelectedRange] = useState<ChartRangeKey>('1m')
  const [historyStartDate, setHistoryStartDate] = useState(defaultHistoryRange.startDate)
  const [historyEndDate, setHistoryEndDate] = useState(defaultHistoryRange.endDate)
  const [historyInterval, setHistoryInterval] = useState<HistoricalInterval>('1d')

  const indicesQuery = useMarketIndices()
  const watchlistQuery = useWatchlist()
  const newsQuery = useMarketNews()
  const sectorsQuery = useMarketSectors()
  const moversQuery = useMarketMovers()
  const globalMarketsQuery = useGlobalMarkets()
  const chartQuery = useMarketChart(selectedSymbol, selectedRange)
  const quoteQuery = useMarketQuote(selectedSymbol)
  const historyQuery = useMarketHistory(selectedSymbol, {
    startDate: historyStartDate,
    endDate: historyEndDate,
    interval: historyInterval,
  })
  const insightQuery = useAiInsight(selectedSymbol, settingsQuery.data?.aiRefreshSeconds)
  const analystFeedQuery = useAnalystFeed(selectedSymbol)
  const compareChartQueries = useMarketCompareCharts(compareSymbols, selectedRange)
  const addMutation = useAddToWatchlist()
  const removeMutation = useRemoveFromWatchlist()

  const chartStyle = settingsQuery.data?.marketPreferences.chartStyle ?? 'area'

  const globalGroups: Record<string, NonNullable<typeof globalMarketsQuery.data>[number][]> = {
    Crypto: [],
    Forex: [],
    Commodities: [],
  }
  for (const asset of globalMarketsQuery.data ?? []) {
    globalGroups[getGlobalCategory(asset.symbol)].push(asset)
  }

  const sp500 = (indicesQuery.data ?? []).find((index) => index.symbol === '^GSPC')
  const advancingSectors = (sectorsQuery.data ?? []).filter((sector) => sector.changePercent >= 0).length
  const totalSectors = sectorsQuery.data?.length ?? 0
  const watchlistAdvancers = (watchlistQuery.data ?? []).filter((stock) => stock.changePercent >= 0).length
  const totalWatchlist = watchlistQuery.data?.length ?? 0
  const topMover = moversQuery.data?.gainers?.[0]
  const workspaceShortcuts = [
    ...(watchlistQuery.data ?? []).slice(0, 8).map((stock) => stock.symbol),
    ...(indicesQuery.data ?? []).slice(0, 4).map((index) => index.symbol),
  ].filter((symbol, index, array) => array.indexOf(symbol) === index && symbol !== selectedSymbol)
  const compareCharts = compareChartQueries
    .map((query) => query.data)
    .filter((chart): chart is MarketChart => Boolean(chart))
  const comparePresets = getComparePresets(selectedSymbol, quoteQuery.data?.sector, compareSymbols).slice(0, 4)

  function handleSelectSymbol(symbol: string) {
    setSelectedSymbol(symbol)
    setDetailTab('overview')
  }

  function handleCloseSymbolDetail() {
    setSelectedSymbol(null)
    setDetailTab('overview')
  }

  function handleOpenWorkspaceSymbol() {
    const symbol = workspaceSymbolInput.trim().toUpperCase()
    if (!symbol) return
    handleSelectSymbol(symbol)
    setWorkspaceSymbolInput('')
  }

  function addCompareSymbol(symbol: string) {
    if (!symbol) return
    if (symbol === selectedSymbol) {
      setCompareError('The active symbol is already the baseline.')
      return
    }
    if (compareSymbols.includes(symbol)) {
      setCompareError('That compare ticker is already active.')
      return
    }
    if (compareSymbols.length >= 4) {
      setCompareError('Compare mode supports up to four extra tickers.')
      return
    }
    setCompareSymbols((current) => [...current, symbol])
    setCompareError('')
  }

  function handleAddCompareSymbol() {
    const symbol = compareSymbolInput.trim().toUpperCase()
    addCompareSymbol(symbol)
    if (symbol) setCompareSymbolInput('')
  }

  function handleRemoveCompareSymbol(symbol: string) {
    setCompareSymbols((current) => current.filter((item) => item !== symbol))
    setCompareError('')
  }

  function applyHistoryPreset(days: number) {
    setHistoryEndDate(getTodayDate())
    setHistoryStartDate(getDateDaysAgo(days))
  }

  function exportHistoryCsv() {
    if (!historyQuery.data || historyQuery.data.points.length === 0) return
    const headers = ['Date', 'Open', 'High', 'Low', 'Midpoint', 'Close', 'Adjusted Close', 'Range %', 'Change %', 'Volume']
    const rows = historyQuery.data.points.map((point) =>
      [
        point.date,
        formatRawNumber(point.open),
        formatRawNumber(point.high),
        formatRawNumber(point.low),
        formatRawNumber(point.midpoint),
        formatRawNumber(point.close),
        formatRawNumber(point.adjClose),
        formatRawNumber(point.rangePercent, 4),
        formatRawNumber(point.changePercent, 4),
        formatRawNumber(point.volume, 0),
      ].join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedSymbol ?? 'market-history'}-${historyStartDate}-to-${historyEndDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleAddWatchlistTicker() {
    const symbol = tickerInput.trim().toUpperCase()
    if (!symbol) return
    setAddError('')
    addMutation.mutate(symbol, {
      onError: () => setAddError('Could not add ticker. Check the symbol or try again.'),
      onSuccess: () => {
        setTickerInput('')
        setSelectedSymbol(symbol)
      },
    })
  }

  function handleRemoveWatchlistTicker(symbol: string) {
    removeMutation.mutate(symbol)
  }

  const isHistoryDateRangeValid = historyStartDate <= historyEndDate

  useEffect(() => {
    const symbolParam = searchParams.get('symbol')
    if (symbolParam) {
      setSelectedSymbol(symbolParam.toUpperCase())
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedSymbol) return
    const nextRange = createDefaultHistoryRange()
    setSelectedRange('3m')
    setHistoryStartDate(nextRange.startDate)
    setHistoryEndDate(nextRange.endDate)
    setHistoryInterval('1d')
    setCompareSymbols([])
    setCompareSymbolInput('')
    setCompareError('')
  }, [selectedSymbol])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">MarketMeh</div>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Dashboard</h1>
      </div>

      {selectedSymbol ? (
        <section className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <button
                  type="button"
                  onClick={handleCloseSymbolDetail}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back To Market Snapshot
                </button>
                <div className="mt-4 text-xs uppercase tracking-wider text-zinc-500">Stock Workspace</div>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <div className="text-3xl font-semibold text-zinc-100">{quoteQuery.data?.name ?? chartQuery.data?.name ?? selectedSymbol}</div>
                  <div className="text-sm font-medium uppercase tracking-wider text-zinc-500">{selectedSymbol}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span className="rounded-full border border-zinc-700 px-2.5 py-1">
                    Street Rating: {analystFeedQuery.data?.gradesConsensus?.rating ?? '--'}
                  </span>
                  <span className="rounded-full border border-zinc-700 px-2.5 py-1">
                    Target Drift: {fmtSignedPercent(analystFeedQuery.data?.priceTargetConsensus?.upsidePercent)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={workspaceSymbolInput}
                    onChange={(event) => setWorkspaceSymbolInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && handleOpenWorkspaceSymbol()}
                    placeholder="Jump to symbol..."
                    className="h-10 w-40 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleOpenWorkspaceSymbol}
                    disabled={!workspaceSymbolInput.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    Open
                  </button>
                </div>

                <div className="flex rounded-xl border border-zinc-700 bg-zinc-950/60 p-1">
                  {([
                    ['overview', 'Overview'],
                    ['analyst', 'Analyst'],
                    ['insight', 'Street + AI'],
                    ['history', 'History'],
                  ] as Array<[StockDetailTab, string]>).map(([tabKey, label]) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setDetailTab(tabKey)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        detailTab === tabKey ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
              <StatItem label="Last Price" value={fmtCurrency(quoteQuery.data?.price ?? chartQuery.data?.price)} />
              <StatItem
                label="Day Move"
                value={
                  quoteQuery.data
                    ? fmtChange(quoteQuery.data.change, quoteQuery.data.changePercent, quoteQuery.data.currency)
                    : '--'
                }
              />
              <StatItem label="Target" value={fmtCurrency(analystFeedQuery.data?.priceTargetConsensus?.consensus)} />
              <StatItem label="Street" value={analystFeedQuery.data?.gradesConsensus?.rating ?? '--'} />
              <StatItem
                label="Support / Resistance"
                value={
                  insightQuery.data?.keyLevels.support !== null && insightQuery.data?.keyLevels.resistance !== null
                    ? `${fmtCurrency(insightQuery.data?.keyLevels.support)} / ${fmtCurrency(insightQuery.data?.keyLevels.resistance)}`
                    : '--'
                }
              />
            </div>

            {workspaceShortcuts.length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Jump Rail</div>
                <div className="flex flex-wrap gap-2">
                  {workspaceShortcuts.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => handleSelectSymbol(symbol)}
                      className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Compare Mode</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Add up to four tickers to compare normalized relative strength against {selectedSymbol}.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={compareSymbolInput}
                    onChange={(event) => setCompareSymbolInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && handleAddCompareSymbol()}
                    placeholder="Add compare..."
                    className="h-10 w-40 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompareSymbol}
                    disabled={!compareSymbolInput.trim()}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
                  >
                    Add Compare
                  </button>
                </div>
              </div>

              {compareSymbols.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {compareSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => handleRemoveCompareSymbol(symbol)}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      {symbol}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              ) : null}

              {comparePresets.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Quick Presets</div>
                  <div className="flex flex-wrap gap-2">
                    {comparePresets.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => addCompareSymbol(symbol)}
                        className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {compareError ? <div className="mt-3 text-sm text-amber-300">{compareError}</div> : null}
            </div>
          </div>

          {detailTab === 'overview' ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
              <ChartPanel
                key={selectedSymbol}
                symbol={selectedSymbol}
                range={selectedRange}
                chart={chartQuery.data}
                compareCharts={compareCharts}
                isLoading={chartQuery.isLoading}
                chartStyle={chartStyle}
                onRangeChange={setSelectedRange}
                initialSma20={settingsQuery.data?.marketPreferences.defaultSma20 ?? true}
                initialSma50={settingsQuery.data?.marketPreferences.defaultSma50 ?? true}
                initialVolume={settingsQuery.data?.marketPreferences.defaultVolume ?? true}
              />
              <QuotePanel symbol={selectedSymbol} quote={quoteQuery.data} isLoading={quoteQuery.isLoading} />
            </div>
          ) : null}

          {detailTab === 'analyst' ? (
            <AnalystPanel
              symbol={selectedSymbol}
              analystFeed={analystFeedQuery.data}
              isLoading={analystFeedQuery.isLoading}
              hasError={analystFeedQuery.isError}
            />
          ) : null}

          {detailTab === 'insight' ? (
            <InsightPanel
              symbol={selectedSymbol}
              insight={insightQuery.data}
              isLoading={insightQuery.isLoading}
              onOpenTab={setDetailTab}
            />
          ) : null}

          {detailTab === 'history' ? (
            <HistoryPanel
              symbol={selectedSymbol}
              history={historyQuery.data}
              isLoading={historyQuery.isLoading}
              isDateRangeValid={isHistoryDateRangeValid}
              startDate={historyStartDate}
              endDate={historyEndDate}
              interval={historyInterval}
              onStartDateChange={setHistoryStartDate}
              onEndDateChange={setHistoryEndDate}
              onIntervalChange={setHistoryInterval}
              onPresetSelect={applyHistoryPreset}
              onExport={exportHistoryCsv}
            />
          ) : null}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="S&P 500"
              value={sp500 ? `${fmtPrice(sp500.price)} (${fmtPercent(sp500.changePercent)})` : '--'}
              tone={sp500 ? (sp500.changePercent >= 0 ? 'positive' : 'negative') : 'neutral'}
            />
            <SummaryCard
              label="Sector Breadth"
              value={totalSectors > 0 ? `${advancingSectors}/${totalSectors} positive` : '--'}
              tone={advancingSectors > totalSectors / 2 ? 'positive' : advancingSectors < totalSectors / 2 ? 'negative' : 'neutral'}
            />
            <SummaryCard
              label="Watchlist Breadth"
              value={totalWatchlist > 0 ? `${watchlistAdvancers}/${totalWatchlist} up` : '--'}
              tone={watchlistAdvancers > totalWatchlist / 2 ? 'positive' : watchlistAdvancers < totalWatchlist / 2 ? 'negative' : 'neutral'}
            />
            <SummaryCard
              label="Lead Gainer"
              value={topMover ? `${topMover.symbol} ${fmtPercent(topMover.changePercent)}` : '--'}
              tone={topMover ? 'positive' : 'neutral'}
            />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Major Indices</h2>
            {indicesQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(indicesQuery.data ?? []).map((index) => (
                  <IndexCard key={index.symbol} index={index} selected={false} onSelect={handleSelectSymbol} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Watchlist</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={tickerInput}
                  onChange={(event) => {
                    setTickerInput(event.target.value.toUpperCase())
                    setAddError('')
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && handleAddWatchlistTicker()}
                  placeholder="Add ticker..."
                  className="h-9 w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddWatchlistTicker}
                  disabled={addMutation.isPending || !tickerInput.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            {addError ? <p className="mb-2 text-xs text-red-400">{addError}</p> : null}

            {watchlistQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(watchlistQuery.data ?? []).map((stock) => (
                  <StockCard
                    key={stock.symbol}
                    stock={stock}
                    selected={false}
                    onSelect={handleSelectSymbol}
                    onRemove={handleRemoveWatchlistTicker}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Top Gainers & Losers</h2>
              {moversQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[...Array(2)].map((_, index) => (
                    <div key={index} className="h-72 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MoversList title="Top Gainers" items={moversQuery.data?.gainers ?? []} onSelect={handleSelectSymbol} />
                  <MoversList title="Top Losers" items={moversQuery.data?.losers ?? []} onSelect={handleSelectSymbol} />
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Global Markets</h2>
              {globalMarketsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-4">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(globalGroups).map(([groupName, assets]) => (
                    <div key={groupName} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="mb-3 text-sm font-semibold text-zinc-100">{groupName}</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {assets.map((asset) => (
                          <GlobalAssetCard key={asset.symbol} asset={asset} selected={false} onSelect={handleSelectSymbol} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sector Performance</h2>
              <div className="flex flex-col gap-2">
                {sectorsQuery.isLoading
                  ? [...Array(6)].map((_, index) => (
                      <div key={index} className="h-12 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                    ))
                  : (sectorsQuery.data ?? []).map((sector) => <SectorCard key={sector.symbol} sector={sector} />)}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Market News</h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
                {newsQuery.isLoading ? (
                  <div className="flex flex-col divide-y divide-zinc-800">
                    {[...Array(6)].map((_, index) => (
                      <div key={index} className="px-3 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-zinc-800/60">
                    {(newsQuery.data ?? []).slice(0, 10).map((item) => (
                      <NewsItem key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
