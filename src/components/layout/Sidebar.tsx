import { NavLink, useLocation } from 'react-router'
import { BarChart3, Filter, Grid3x3, Settings, Wallet, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/use-settings'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  advancedOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/sectors', label: 'Sectors', icon: <Grid3x3 size={18} /> },
  { to: '/screener', label: 'Screener', icon: <Filter size={18} />, advancedOnly: true },
  { to: '/portfolio', label: 'Portfolio', icon: <Wallet size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
]

export function Sidebar() {
  const { data: settings } = useSettings()
  const isAdvanced = settings?.mode === 'advanced'
  const location = useLocation()

  return (
    <aside className="flex h-full w-52 flex-shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-950">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800/60 px-4">
        <img src="/favicon.svg" alt="MarketMeh" className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight text-zinc-100">MarketMeh</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {NAV_ITEMS.filter(item => !item.advancedOnly || isAdvanced).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — mode indicator */}
      <div className="border-t border-zinc-800/60 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">Mode</span>
          <NavLink
            to="/settings"
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isAdvanced
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-800 text-zinc-400',
            )}
          >
            {isAdvanced ? 'Advanced' : 'Simple'}
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
