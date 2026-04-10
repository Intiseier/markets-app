export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center">
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{detail}</div>
    </div>
  )
}
