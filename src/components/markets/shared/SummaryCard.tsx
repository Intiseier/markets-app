import { cn } from '@/lib/utils'

export function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone === 'positive' && 'text-emerald-400',
          tone === 'negative' && 'text-red-400',
          tone === 'neutral' && 'text-zinc-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}
