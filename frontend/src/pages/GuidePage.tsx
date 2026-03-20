import { useState, useMemo } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/shared/Card'
import { TabGroup } from '../components/shared/TabGroup'
import { Link } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const PIE_COLORS = ['#C0110E', '#F5D44A', '#FBC8C8']
const BAR_COLORS = ['#C0110E', '#F5D44A', '#22C55E', '#3B82F6']

const tabs = [
  { key: 'eating', label: 'Eating Routine' },
  { key: 'potty', label: 'Potty (Output)' },
  { key: 'hygiene', label: 'Hygiene & Meds' },
]

export function GuidePage() {
  const [weight, setWeight] = useState(3.5)
  const [feedMethod, setFeedMethod] = useState<'bottle' | 'breast'>('bottle')
  const [activeTab, setActiveTab] = useState('eating')
  const [safetyChecks, setSafetyChecks] = useState([false, false, false, false])

  const calculations = useMemo(() => {
    const totalVolume = Math.round(weight * 150)
    const feedFreq = weight < 3 ? 10 : weight < 4 ? 9 : 8
    const feedsLabel = weight < 3 ? '10-12' : weight < 4 ? '8-10' : '7-8'
    const volPerFeed = Math.round(totalVolume / feedFreq)
    return { totalVolume, feedFreq, feedsLabel, volPerFeed, diaperGoal: '6+' }
  }, [weight])

  const pieData = [
    { name: 'Feeding', value: 35 },
    { name: 'Sleep', value: 50 },
    { name: 'Alert/Play', value: 15 },
  ]

  const barData = [
    { zone: 'Low', diapers: 3 },
    { zone: 'OK', diapers: 5 },
    { zone: 'Optimal', diapers: 7 },
    { zone: 'Excellent', diapers: 9 },
  ]

  const toggleCheck = (i: number) => {
    const next = [...safetyChecks]
    next[i] = !next[i]
    setSafetyChecks(next)
  }

  return (
    <PageContainer>
      {/* Hero */}
      <section className="bg-primary-500 rounded-xl p-8 text-center text-white mb-8">
        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">
          Understanding the "Flow"
        </h1>
        <p className="text-white/80 max-w-xl mx-auto">
          For a newborn with <strong>Hydronephrosis</strong> (swelling of the kidney due to urine
          buildup), the routine focuses on one golden rule: <strong>Keep it moving.</strong>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[
            {
              icon: '🍼',
              title: 'Frequent Intake',
              desc: 'More fluid in equals more flushing of the urinary tract.',
            },
            {
              icon: '🛡️',
              title: 'Strict Hygiene',
              desc: 'Preventing bacteria from entering is critical to avoid UTIs.',
            },
            {
              icon: '⚖️',
              title: 'Monitor Output',
              desc: 'Wet diapers are your primary data point for kidney function.',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white/10 backdrop-blur rounded-lg p-5 text-left"
            >
              <div className="text-3xl mb-2">{card.icon}</div>
              <h3 className="font-bold text-white mb-1">{card.title}</h3>
              <p className="text-sm text-white/70">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Routine Builder */}
      <Card className="mb-8" padding="lg">
        <div className="bg-primary-50 -m-6 mb-6 p-6 rounded-t-lg border-b border-primary-100">
          <h2 className="text-xl font-bold text-dark flex items-center gap-2">
            <span>⚙️</span> ROUTINE BUILDER
          </h2>
          <p className="text-muted mt-1">
            Enter your baby's details to calculate a safe baseline routine.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="space-y-6 bg-bg p-5 rounded-xl border border-border">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-muted mb-2">
                Baby's Weight (kg)
              </label>
              <input
                type="range"
                min={2.5}
                max={6.0}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-muted">2.5kg</span>
                <span className="text-lg font-bold text-primary-500">{weight.toFixed(1)} kg</span>
                <span className="text-xs text-muted">6.0kg</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-muted mb-2">
                Feeding Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFeedMethod('bottle')}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    feedMethod === 'bottle'
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-surface text-muted border-border'
                  }`}
                >
                  Bottle (mL)
                </button>
                <button
                  onClick={() => setFeedMethod('breast')}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    feedMethod === 'breast'
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-surface text-muted border-border'
                  }`}
                >
                  Breast (Time)
                </button>
              </div>
            </div>

            <div className="bg-accent-50 p-4 rounded-lg border border-accent-200">
              <h4 className="text-accent-500 font-bold text-sm mb-1">⚠️ Medical Note</h4>
              <p className="text-xs text-muted">
                Calculations are based on standard fluid requirements (150ml/kg/day). Always follow
                your nephrologist's specific volume limits.
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-primary-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {calculations.totalVolume}
                </div>
                <div className="text-xs text-primary-500 uppercase tracking-wide font-semibold">
                  Total mL/Day
                </div>
              </div>
              <div className="bg-primary-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {calculations.feedsLabel}
                </div>
                <div className="text-xs text-primary-500 uppercase tracking-wide font-semibold">
                  Feeds/Day
                </div>
              </div>
              <div className="bg-accent-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-accent-500">
                  {feedMethod === 'bottle'
                    ? calculations.volPerFeed
                    : `${Math.round(calculations.volPerFeed / 3)}min`}
                </div>
                <div className="text-xs text-accent-400 uppercase tracking-wide font-semibold">
                  {feedMethod === 'bottle' ? 'mL per Feed' : 'Per Side'}
                </div>
              </div>
              <div className="bg-bg p-4 rounded-lg text-center border border-border">
                <div className="text-2xl font-bold text-dark">{calculations.diaperGoal}</div>
                <div className="text-xs text-muted uppercase tracking-wide font-semibold">
                  Heavy Diapers
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface rounded-lg p-4 border border-border">
                <h3 className="text-center text-xs font-bold uppercase tracking-wider text-muted mb-3">
                  Ideal 24h Distribution
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted mt-2">
                  {pieData.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: PIE_COLORS[i] }}
                      />
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-lg p-4 border border-border">
                <h3 className="text-center text-xs font-bold uppercase tracking-wider text-muted mb-3">
                  Hydration Safety Zones
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis
                        dataKey="zone"
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: '#E5E7EB' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: '#E5E7EB' }}
                      />
                      <Tooltip />
                      <Bar dataKey="diapers" radius={[4, 4, 0, 0]}>
                        {barData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-muted mt-2">
                  Maintain "Optimal" zone to flush kidneys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabbed Content */}
      <Card className="mb-8" padding="lg">
        <h2 className="text-lg font-bold uppercase tracking-wide text-dark mb-4">
          The "Why" & "How"
        </h2>

        <TabGroup tabs={tabs} active={activeTab} onChange={setActiveTab} className="mb-6" />

        {activeTab === 'eating' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-l-4 border-primary-200 pl-6 space-y-4">
              <h3 className="text-lg font-bold text-dark">Feeding Strategy</h3>
              <p className="text-muted">
                Frequent, smaller feeds maintain consistent hydration. For hydronephrosis, the goal
                is steady fluid throughput rather than large boluses.
              </p>
              <ul className="list-disc list-inside text-muted space-y-1 text-sm">
                <li>Feed every 2-3 hours during the day</li>
                <li>Night feeds: at least every 3-4 hours for newborns</li>
                <li>Watch for hunger cues: rooting, hand-to-mouth, fussiness</li>
                <li>Avoid letting the baby sleep longer than 4 hours without a feed</li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg p-5">
              <h4 className="font-bold text-primary-700 text-sm uppercase tracking-wider mb-3">
                Sample Feeding Log
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-200">
                      <th className="text-left py-2 text-primary-600">Time</th>
                      <th className="text-left py-2 text-primary-600">Amount</th>
                      <th className="text-left py-2 text-primary-600">Method</th>
                    </tr>
                  </thead>
                  <tbody className="text-dark">
                    {[
                      ['6:00 AM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['8:30 AM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['11:00 AM', `${calculations.volPerFeed}ml`, 'Breast + top-up'],
                      ['1:30 PM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['4:00 PM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['6:30 PM', `${calculations.volPerFeed}ml`, 'Breast + top-up'],
                      ['9:00 PM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['12:00 AM', `${calculations.volPerFeed}ml`, 'Bottle'],
                      ['3:00 AM', `${calculations.volPerFeed}ml`, 'Bottle'],
                    ].map(([time, amount, method]) => (
                      <tr key={time} className="border-b border-primary-100/50">
                        <td className="py-2">{time}</td>
                        <td className="py-2">{amount}</td>
                        <td className="py-2">{method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'potty' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-l-4 border-primary-200 pl-6 space-y-4">
              <h3 className="text-lg font-bold text-dark">Urine Color Guide</h3>
              <p className="text-muted">
                Diaper output is your most reliable indicator of hydration and kidney function.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  color: 'bg-yellow-100',
                  label: 'Pale Yellow',
                  status: 'Excellent',
                  badge: 'text-green-700 bg-green-100',
                },
                {
                  color: 'bg-yellow-300',
                  label: 'Dark Yellow',
                  status: 'Needs More Fluids',
                  badge: 'text-yellow-700 bg-yellow-100',
                },
                {
                  color: 'bg-pink-200',
                  label: 'Pink/Red',
                  status: 'Call Doctor',
                  badge: 'text-red-700 bg-red-100',
                },
              ].map((item) => (
                <div key={item.label} className="border border-border rounded-lg p-4 text-center">
                  <div className={`w-12 h-12 ${item.color} rounded-full mx-auto mb-2`} />
                  <p className="font-bold text-dark text-sm">{item.label}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${item.badge}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-primary-50 rounded-lg p-5">
              <h4 className="font-bold text-primary-700 text-sm uppercase tracking-wider mb-3">
                Diaper Tracking Protocol
              </h4>
              <ul className="list-disc list-inside text-muted space-y-1 text-sm">
                <li>
                  <strong>Day 1-2:</strong> At least 1-2 wet diapers per day (colostrum phase)
                </li>
                <li>
                  <strong>Day 3-4:</strong> At least 3-4 wet diapers as milk comes in
                </li>
                <li>
                  <strong>Day 5+:</strong> 6+ heavy wet diapers per day (gold standard)
                </li>
                <li>
                  <strong>Stool:</strong> Transition from meconium (black) to mustard yellow by day
                  4-5
                </li>
                <li>
                  <strong>Alert:</strong> White/clay-colored stool requires immediate medical attention
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'hygiene' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-l-4 border-primary-200 pl-6 space-y-4">
              <h3 className="text-lg font-bold text-dark">UTI Prevention</h3>
              <p className="text-muted">
                For babies with hydronephrosis, UTI prevention is critical. Bacteria entering the
                urinary tract can cause serious kidney damage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  icon: '🧹',
                  title: 'Front-to-Back Wiping',
                  desc: 'Always wipe from front to back during diaper changes to prevent bacteria from reaching the urethra.',
                },
                {
                  icon: '🧴',
                  title: 'Barrier Cream',
                  desc: 'Apply zinc oxide or petroleum-based cream to protect skin. Avoid scented products.',
                },
                {
                  icon: '🚿',
                  title: 'Frequent Changes',
                  desc: 'Change diapers promptly. Prolonged exposure to stool significantly increases UTI risk.',
                },
                {
                  icon: '⚠️',
                  title: 'No Scented Products',
                  desc: 'Avoid scented wipes, bubble baths, and fragranced soaps near the genital area.',
                },
              ].map((item) => (
                <div key={item.title} className="bg-bg p-4 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-dark text-sm">{item.title}</h4>
                      <p className="text-xs text-muted mt-1">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary-500 text-white rounded-lg p-5">
              <h4 className="font-bold text-sm uppercase tracking-wider mb-3">
                🚨 When to Call the Doctor
              </h4>
              <ul className="list-disc list-inside text-sm space-y-1 text-white/90">
                <li>Fever above 38°C (100.4°F) in a newborn</li>
                <li>Foul-smelling or cloudy urine</li>
                <li>Blood in urine (pink/red tinge)</li>
                <li>Persistent crying during urination</li>
                <li>Fewer than 6 wet diapers after day 5</li>
                <li>Swelling or tenderness in the flank/kidney area</li>
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Daily Safety Check */}
      <div className="bg-dark text-white rounded-xl p-6 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4">
          ✅ Daily Safety Check
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Adequate feeds completed (8+ feeds or per plan)',
            '6+ heavy wet diapers observed',
            'No fever (temp below 38°C)',
            'Baby alert and responsive during wake periods',
          ].map((label, i) => (
            <label
              key={i}
              className="flex items-center gap-3 bg-white/10 rounded-lg p-3 cursor-pointer hover:bg-white/15 transition-colors"
            >
              <input
                type="checkbox"
                checked={safetyChecks[i]}
                onChange={() => toggleCheck(i)}
                className="w-5 h-5 accent-accent-300 rounded"
              />
              <span className="text-sm text-white/90">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <Link
          to="/supply-strategies"
          className="px-5 py-2.5 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors no-underline text-sm uppercase tracking-wide"
        >
          🍼 Supply Tips
        </Link>
        <Link
          to="/tracker"
          className="px-5 py-2.5 bg-accent-300 text-dark font-semibold rounded-lg hover:bg-accent-400 transition-colors no-underline text-sm uppercase tracking-wide"
        >
          📊 Tracker
        </Link>
      </div>
    </PageContainer>
  )
}
