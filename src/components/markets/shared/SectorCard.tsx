import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectorPerformance } from '@/types/market'
import { fmtPercent } from './formatters'

export function SectorCard({ sector }: { sector: SectorPerformance }) {
  const positive = sector.changePercent >= 0

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <span className="text-sm font-medium text-zinc-300">{sector.name}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-semibold tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
          {fmtPercent(sector.changePercent)}
        </span>
        {positive ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
      </div>
    </div>
  )
}
