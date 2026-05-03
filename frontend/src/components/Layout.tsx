import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBaby } from '../contexts/BabyContext'
import {
  Home, Bottle, Chart, Settings, Warning,
  Bell, LogOut, Drop, Spark
} from './Icons'

interface NavItem {
  to: string
  label: string
  icon: (p: { size?: number; color?: string }) => JSX.Element
}

const NAV: NavItem[] = [
  { to: '/today',   label: 'Today',     icon: Home },
  { to: '/log',     label: 'Quick log', icon: Bottle },
  { to: '/routine', label: 'Routine',   icon: Spark },
  { to: '/stats',   label: 'Stats',     icon: Chart },
  { to: '/settings',label: 'Settings',  icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { activeBaby, babies, setActiveBabyId } = useBaby()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar desktop-only">
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'var(--sage-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Drop size={16} color="var(--sage-d)" />
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>
              neonate.<span style={{ color: 'var(--sage-d)' }}>care</span>
            </div>
          </div>

          {/* Baby switcher */}
          {babies.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Baby</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {babies.map(b => (
                  <button key={b.id} onClick={() => setActiveBabyId(b.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: b.id === activeBaby?.id ? 'var(--sage-bg)' : 'transparent',
                    color: b.id === activeBaby?.id ? 'var(--sage-d)' : 'var(--ink-soft)',
                    fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, textAlign: 'left',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 13, background: 'var(--cream-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    }}>🍼</div>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '0 10px' }}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginBottom: 2,
              textDecoration: 'none', fontWeight: 500, fontSize: 14,
              background: isActive ? 'var(--sage-bg)' : 'transparent',
              color: isActive ? 'var(--sage-d)' : 'var(--ink-soft)',
              transition: 'background 0.12s',
            })}>
              {({ isActive }) => <>
                <Icon size={18} color={isActive ? 'var(--sage-d)' : 'var(--ink-mute)'} />
                {label}
              </>}
            </NavLink>
          ))}

          <div style={{ height: 1, background: 'var(--line)', margin: '12px 2px' }} />

          <NavLink to="/emergency" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12, marginBottom: 2,
            textDecoration: 'none', fontWeight: 500, fontSize: 14,
            background: isActive ? '#fce8e8' : 'transparent',
            color: isActive ? 'var(--bad)' : 'var(--ink-soft)',
          })}>
            {({ isActive }) => <>
              <Warning size={18} color={isActive ? 'var(--bad)' : 'var(--ink-mute)'} />
              Emergency
            </>}
          </NavLink>
        </nav>

        <div style={{ padding: '0 20px' }}>
          {user && (
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          )}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--ink-soft)',
            fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, width: '100%',
          }}>
            <LogOut size={16} color="var(--ink-mute)" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{ paddingBottom: 72 }}>
        {/* Mobile top bar */}
        <div className="mobile-only" style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(250,246,238,0.92)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--line)',
          padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>
            neonate.<span style={{ color: 'var(--sage-d)' }}>care</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeBaby && (
              <span className="chip sage" style={{ fontSize: 11 }}>🍼 {activeBaby.name}</span>
            )}
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Bell size={18} color="var(--ink-soft)" />
            </button>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav mobile-only">
        {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '4px 0',
              }}>
                <Icon size={20} color={isActive ? 'var(--sage-d)' : 'var(--ink-mute)'} />
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isActive ? 'var(--sage-d)' : 'var(--ink-mute)',
                  letterSpacing: '0.04em',
                }}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
