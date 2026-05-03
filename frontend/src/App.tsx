import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

import Login          from './pages/Login'
import Register       from './pages/Register'
import Onboarding     from './pages/Onboarding'
import Today          from './pages/Today'
import QuickLog       from './pages/QuickLog'
import Routine        from './pages/Routine'
import Stats          from './pages/Stats'
import Growth         from './pages/Growth'
import HandExpression from './pages/HandExpression'
import Supply         from './pages/Supply'
import Emergency      from './pages/Emergency'
import Settings       from './pages/Settings'
import About          from './pages/About'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)' }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireOnboarding({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (user && !user.onboarding_complete) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/"         element={<Navigate to="/today" replace />} />

      {/* Protected — onboarding (no Layout shell) */}
      <Route path="/onboarding" element={
        <RequireAuth><Onboarding /></RequireAuth>
      }/>

      {/* Protected — main app (with Layout shell) */}
      <Route path="/*" element={
        <RequireAuth>
          <RequireOnboarding>
            <Layout>
              <Routes>
                <Route path="/today"           element={<Today />} />
                <Route path="/log"             element={<QuickLog />} />
                <Route path="/routine"         element={<Routine />} />
                <Route path="/stats"           element={<Stats />} />
                <Route path="/growth"          element={<Growth />} />
                <Route path="/hand-expression" element={<HandExpression />} />
                <Route path="/supply"          element={<Supply />} />
                <Route path="/emergency"       element={<Emergency />} />
                <Route path="/settings"        element={<Settings />} />
                <Route path="/about"           element={<About />} />
                <Route path="*"               element={<Navigate to="/today" replace />} />
              </Routes>
            </Layout>
          </RequireOnboarding>
        </RequireAuth>
      }/>
    </Routes>
  )
}
