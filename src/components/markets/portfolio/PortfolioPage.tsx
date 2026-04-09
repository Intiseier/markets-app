import { Wallet, TrendingUp, TrendingDown, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  usePortfolio,
  useAddPortfolioPosition,
  useUpdatePortfolioPosition,
  useRemovePortfolioPosition,
} from '@/hooks/use-markets'
import type { PortfolioPosition, PortfolioPositionInput } from '@/types/market'
import { cn } from '@/lib/utils'
import {
  fmtCurrency,
  fmtSignedCurrency,
  fmtNumber,
  fmtPercent,
  getTodayDate,
} from '../shared/formatters'

interface PortfolioFormState {
  symbol: string
  shares: string
  costBasis: string
  dateAdded: string
}

function createEmptyForm(): PortfolioFormState {
  return { symbol: '', shares: '', costBasis: '', dateAdded: getTodayDate() }
}

export function PortfolioPage() {
  const navigate = useNavigate()
  const portfolioQuery = usePortfolio()
  const addMutation = useAddPortfolioPosition()
  const updateMutation = useUpdatePortfolioPosition()
  const removeMutation = useRemovePortfolioPosition()

  const [form, setForm] = useState<PortfolioFormState>(createEmptyForm())
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [error, setError] = useState('')

  const totals = portfolioQuery.data?.totals
  const positions = portfolioQuery.data?.positions ?? []

  function resetForm() {
    setForm(createEmptyForm())
    setEditingSymbol(null)
    setError('')
  }

  function handleEdit(position: PortfolioPosition) {
    setEditingSymbol(position.symbol)
    setError('')
    setForm({
      symbol: position.symbol,
      shares: String(position.shares),
      costBasis: String(position.costBasis),
      dateAdded: position.dateAdded,
    })
  }

  function handleDelete(symbol: string) {
    setError('')
    removeMutation.mutate(symbol, {
      onError: () => setError('Could not remove that position.'),
      onSuccess: () => { if (editingSymbol === symbol) resetForm() },
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const symbol = form.symbol.trim().toUpperCase()
    const shares = Number(form.shares)
    const costBasis = Number(form.costBasis)
    if (!symbol) return setError('Symbol is required.')
    if (!Number.isFinite(shares) || shares <= 0) return setError('Shares must be greater than zero.')
    if (!Number.isFinite(costBasis) || costBasis < 0) return setError('Cost basis must be zero or greater.')
    if (!form.dateAdded) return setError('Date added is required.')

    setError('')
    const payload: PortfolioPositionInput = { symbol, shares, costBasis, dateAdded: form.dateAdded }

    if (editingSymbol) {
      updateMutation.mutate({ symbol: editingSymbol, position: payload }, {
        onError: () => setError('Could not update that position.'),
        onSuccess: () => resetForm(),
      })
    } else {
      addMutation.mutate(payload, {
        onError: () => setError('Could not add position. Check the symbol.'),
        onSuccess: () => resetForm(),
      })
    }
  }

  const totalPositive = (totals?.totalPlDollar ?? 0) >= 0

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">MarketMeh</div>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Portfolio</h1>
      </div>

      {/* Summary strip */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Cost', value: fmtCurrency(totals.totalCost) },
            { label: 'Market Value', value: fmtCurrency(totals.totalMarketValue) },
            { label: 'Total P&L', value: fmtSignedCurrency(totals.totalPlDollar) },
            { label: 'P&L %', value: fmtPercent(totals.totalPlPercent) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-zinc-900/60 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{item.label}</div>
              <div className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                item.label.includes('P&L') && totalPositive ? 'text-emerald-400' :
                item.label.includes('P&L') && !totalPositive ? 'text-red-400' : 'text-zinc-100'
              )}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Add / edit form */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">{editingSymbol ? 'Edit Position' : 'Add Position'}</div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {editingSymbol ? `Update ${editingSymbol}` : 'Track a new holding'}
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="p-symbol" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Symbol</label>
              <input
                id="p-symbol"
                type="text"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
                disabled={Boolean(editingSymbol)}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-shares" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Shares</label>
                <input id="p-shares" type="number" min="0" step="any" value={form.shares}
                  onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
                  placeholder="10"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-cost" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Cost Basis</label>
                <input id="p-cost" type="number" min="0" step="any" value={form.costBasis}
                  onChange={(e) => setForm((f) => ({ ...f, costBasis: e.target.value }))}
                  placeholder="182.50"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="p-date" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Date Added</label>
              <input id="p-date" type="date" value={form.dateAdded}
                onChange={(e) => setForm((f) => ({ ...f, dateAdded: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <button type="submit"
                disabled={addMutation.isPending || updateMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {editingSymbol ? 'Update' : 'Add Position'}
              </button>
              {editingSymbol && (
                <button type="button" onClick={resetForm}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Holdings table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Positions</div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">Holdings</div>
            </div>
            <div className="text-sm text-zinc-500">{positions.length} tracked</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            {portfolioQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-950/70" />
                ))}
              </div>
            ) : positions.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                <Wallet className="mx-auto mb-3 h-8 w-8 opacity-30" />
                <p className="text-sm">No positions yet. Add one to get started.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th className="pb-3 pr-4 font-medium">Symbol</th>
                    <th className="pb-3 pr-4 font-medium">Shares</th>
                    <th className="pb-3 pr-4 font-medium">Cost</th>
                    <th className="pb-3 pr-4 font-medium">Current</th>
                    <th className="pb-3 pr-4 font-medium">Value</th>
                    <th className="pb-3 pr-4 font-medium">P&L</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const positive = position.plDollar >= 0
                    return (
                      <tr key={position.symbol} className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40">
                        <td className="py-3 pr-4">
                          <button type="button" onClick={() => navigate(`/dashboard?symbol=${position.symbol}`)}
                            className="text-left"
                          >
                            <div className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors">{position.symbol}</div>
                            <div className="text-xs text-zinc-500">{position.name}</div>
                          </button>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtNumber(position.shares)}</td>
                        <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtCurrency(position.costBasis)}</td>
                        <td className="py-3 pr-4 tabular-nums text-zinc-300">{fmtCurrency(position.currentPrice)}</td>
                        <td className="py-3 pr-4 tabular-nums font-medium text-zinc-100">{fmtCurrency(position.marketValue)}</td>
                        <td className={cn('py-3 pr-4 tabular-nums font-medium', positive ? 'text-emerald-400' : 'text-red-400')}>
                          <div>{fmtSignedCurrency(position.plDollar)}</div>
                          <div className="text-xs opacity-80">{fmtPercent(position.plPercent)}</div>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{position.dateAdded}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => handleEdit(position)}
                              className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                            >
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => handleDelete(position.symbol)}
                              className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
