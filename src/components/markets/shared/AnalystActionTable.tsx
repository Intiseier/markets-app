import { cn } from '@/lib/utils'
import type { AnalystActionItem } from '@/types/market'
import { formatDateCell, getAnalystActionMeta, getAnalystRatingClass } from './formatters'
import { EmptyState } from './EmptyState'

export function AnalystActionTable({
  title,
  items,
}: {
  title: string
  items: AnalystActionItem[]
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">{title}</div>
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800/70">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Firm</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Rating Change</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const actionMeta = getAnalystActionMeta(item.action)
                return (
                  <tr key={`${item.date}-${item.firm}-${index}`} className="border-b border-zinc-800/50 last:border-b-0">
                    <td className="px-4 py-3 text-zinc-300">{item.date ? formatDateCell(item.date) : '--'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{item.firm ?? item.publisher ?? '--'}</div>
                      {item.publisher && item.publisher !== item.firm ? (
                        <div className="mt-1 text-xs text-zinc-500">{item.publisher}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider', actionMeta.className)}>
                        {actionMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-400">
                          {item.priorGrade ?? '--'}
                        </span>
                        <span className="text-zinc-600">→</span>
                        <span className={cn('rounded-md border px-2 py-1 text-xs font-medium', getAnalystRatingClass(item.newGrade))}>
                          {item.newGrade ?? '--'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <EmptyState title="No actions available" detail="This feed did not return recent analyst actions for the selected symbol." />
        </div>
      )}
    </div>
  )
}
