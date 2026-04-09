import { Outlet } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const queryClient = useQueryClient()

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ['markets'] })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-5 backdrop-blur">
          <div className="text-xs text-zinc-600 tabular-nums">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
