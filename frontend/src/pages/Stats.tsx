import { useEffect, useState } from 'react'
import { logsApi } from '../api'
import type { DayStats } from '../api/types'
import { useBaby } from '../contexts/BabyContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export default function Stats() {
  const { activeBaby } = useBaby()
  const [week, setWeek] = useState<DayStats[]>([])
  const [today, setToday] = useState<DayStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeBaby) return
    setLoading(true)
    Promise.all([logsApi.weekStats(activeBaby.id), logsApi.todayStats(activeBaby.id)])
      .then(([w, t]) => { setWeek(w.data); setToday(t.data) })
      .finally(() => setLoading(false))
  }, [activeBaby?.id])

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const chartData = week.map((d, i) => ({
    day: dayLabels[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1],
    ml: Math.round(d.total_ml),
    feeds: d.feed_count,
    wet: d.wet_count,
  }))

  const todayIdx = (new Date().getDay() + 6) % 7

  if (loading) return <div className="page-pad" style={{ color: 'var(--ink-mute)' }}>Loading stats…</div>

  const totalFeeds = week.reduce((a, d) => a + d.feed_count, 0)
  const totalMl    = week.reduce((a, d) => a + d.total_ml, 0)
  const avgTemp    = week.filter(d => d.avg_temp).map(d => d.avg_temp!)
  const tempAvg    = avgTemp.length ? (avgTemp.reduce((a, b) => a + b, 0) / avgTemp.length).toFixed(1) : null
  const avgWet     = (week.reduce((a, d) => a + d.wet_count, 0) / Math.max(week.length, 1)).toFixed(1)

  return (
    <div className="page-pad">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
          This week
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
          Steady progress.
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>
          {activeBaby?.name} · last 7 days
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { v: String(totalFeeds), l: 'feeds',       badge: `${today?.feed_count ?? 0} today`,     c: 'sage' },
          { v: `${(totalMl / 1000).toFixed(1)}L`,   l: 'volume',     badge: `${Math.round(today?.total_ml ?? 0)} ml today`, c: 'sky' },
          { v: tempAvg ? `${tempAvg}°` : '—',       l: 'avg temp',   badge: 'normal',               c: 'butter' },
          { v: `${avgWet}/d`,                         l: 'wet diapers',badge: 'goal: 6+',             c: 'rose' },
        ].map(s => {
          const fgMap: Record<string, string> = { sage: 'var(--sage-d)', sky: '#4A6B7C', butter: '#8E6E2E', rose: '#8E5454' }
          const bgMap: Record<string, string> = { sage: 'var(--sage-bg)', sky: 'var(--sky-bg)', butter: 'var(--butter-bg)', rose: 'var(--rose-bg)' }
          return (
            <div key={s.l} style={{ background: 'var(--paper)', borderRadius: 16, padding: '12px 14px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.l}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: bgMap[s.c], color: fgMap[s.c], fontWeight: 600 }}>{s.badge}</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginTop: 4 }}>{s.v}</div>
            </div>
          )
        })}
      </div>

      {/* Bar chart — feed volume */}
      <div style={{ background: 'var(--paper)', borderRadius: 18, padding: '16px 16px 8px', border: '1px solid var(--line)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>Feed volume / day</span>
          <span className="chip" style={{ fontSize: 10 }}>ml</span>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--ink-mute)', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(v: number) => [`${v} ml`, 'Volume']}
            />
            <Bar dataKey="ml" radius={[6, 6, 2, 2]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === todayIdx ? 'var(--sage)' : 'var(--sage-l)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Feed count chart */}
      <div style={{ background: 'var(--paper)', borderRadius: 18, padding: '16px 16px 8px', border: '1px solid var(--line)', marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>Feed count / day</span>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--ink-mute)', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
              formatter={(v: number) => [`${v} feeds`, 'Feeds']}
            />
            <Bar dataKey="feeds" radius={[6, 6, 2, 2]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === todayIdx ? '#4A6B7C' : 'var(--sky-bg)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Patterns */}
      <div style={{ background: 'var(--cream-2)', borderRadius: 16, padding: '14px 16px', border: '1px dashed var(--ink-faint)' }}>
        <div style={{ fontFamily: 'var(--hand)', fontSize: 17, color: 'var(--sage-d)', marginBottom: 8 }}>patterns →</div>
        {[
          `${totalFeeds} total feeds this week (avg ${(totalFeeds / 7).toFixed(1)}/day)`,
          `${Math.round(totalMl)} ml total volume logged`,
          `Average ${avgWet} wet diapers/day${activeBaby?.care_plan === 'hydronephrosis' ? ' (target: 8+)' : ' (target: 6+)'}`,
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, padding: '3px 0' }}>
            <span style={{ color: 'var(--sage-d)', fontWeight: 700 }}>·</span>{t}
          </div>
        ))}
      </div>
    </div>
  )
}
