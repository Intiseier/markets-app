import { ExternalLink } from 'lucide-react'
import type { MarketNews } from '@/types/market'
import { timeAgo } from './formatters'

export function NewsItem({ item }: { item: MarketNews }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-800/50"
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-200 group-hover:text-white">{item.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">{item.source}</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
        {item.tags && item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
    </a>
  )
}
