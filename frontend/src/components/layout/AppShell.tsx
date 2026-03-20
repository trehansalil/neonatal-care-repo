import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const location = useLocation()
  const showBottomNav = location.pathname === '/tracker'

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <Outlet />
      {showBottomNav && <BottomNav />}
    </div>
  )
}
