import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/components/markets/dashboard/DashboardPage'
import { SectorsPage } from '@/components/markets/sectors/SectorsPage'
import { SectorDetailPage } from '@/components/markets/sectors/SectorDetailPage'
import { ScreenerPage } from '@/components/markets/screener/ScreenerPage'
import { PortfolioPage } from '@/components/markets/portfolio/PortfolioPage'
import { SettingsPage } from '@/components/markets/settings/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sectors" element={<SectorsPage />} />
          <Route path="/sectors/:key" element={<SectorDetailPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
