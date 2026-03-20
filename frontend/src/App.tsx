import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TrackerPage } from './pages/TrackerPage'
import { GuidePage } from './pages/GuidePage'
import SupplyStrategiesPage from './pages/SupplyStrategiesPage'
import HandExpressionPage from './pages/HandExpressionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<GuidePage />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/supply-strategies" element={<SupplyStrategiesPage />} />
          <Route path="/hand-expression" element={<HandExpressionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
