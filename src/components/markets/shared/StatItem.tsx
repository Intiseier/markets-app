export function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  )
}
