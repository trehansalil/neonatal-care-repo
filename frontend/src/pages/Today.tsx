import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logsApi } from '../api'
import type { DayStats, LogEntry } from '../api/types'
import { useBaby } from '../contexts/BabyContext'
import { Bottle, Drop, Moon, Pill, Diaper, Heart, Plus, Check, Sun } from '../components/Icons'

const COLOR_MAP = {
  feed_bottle: { bg: 'var(--sage-bg)',    fg: 'var(--sage-d)',  label: 'Bottle feed' },
  feed_breast: { bg: 'var(--sage-bg)',    fg: 'var(--sage-d)',  label: 'Breast feed' },
  wet:         { bg: 'var(--sky-bg)',     fg: '#4A6B7C',        label: 'Wet diaper' },
  soiled:      { bg: 'var(--butter-bg)', fg: '#8E6E2E',        label: 'Soiled' },
  sleep_start: { bg: 'var(--rose-bg)',   fg: '#8E5454',        label: 'Sleep start' },
  sleep_end:   { bg: 'var(--rose-bg)',   fg: '#8E5454',        label: 'Sleep end' },
  meds:        { bg: 'var(--apricot-bg)',fg: '#8E5A38',        label: 'Meds' },
  temp:        { bg: 'var(--cream-2)',   fg: 'var(--ink-soft)',label: 'Temperature' },
}

function LogIcon({ type, size = 14, color }: { type: string; size?: number; color: string }) {
  if (type === 'feed_bottle') return <Bottle size={size} color={color} />
  if (type === 'feed_breast') return <Heart size={size} color={color} />
  if (type === 'wet')         return <Drop size={size} color={color} />
  if (type === 'soiled')      return <Diaper size={size} color={color} />
  if (type.startsWith('sleep')) return <Moon size={size} color={color} />
  if (type === 'meds')        return <Pill size={size} color={color} />
  return <Sun size={size} color={color} />
}

function dayLabel(date: Date) {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 90) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dateDaysSince(dob: string): number {
  const ms = Date.now() - new Date(dob).getTime()
  return Math.floor(ms / 86400000)
}

export default function Today() {
  const { activeBaby } = useBaby()
  const [stats, setStats] = useState<DayStats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeBaby) return
    setLoading(true)
    Promise.all([
      logsApi.todayStats(activeBaby.id),
      logsApi.list(activeBaby.id, 20),
    ]).then(([s, l]) => {
      setStats(s.data)
      setLogs(l.data)
    }).finally(() => setLoading(false))
  }, [activeBaby?.id])

  if (!activeBaby) {
    return (
      <div className="page-pad" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍼</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, marginBottom: 8 }}>No baby profile yet</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>Complete onboarding to get started.</p>
        <Link to="/onboarding" className="btn btn-primary">Set up profile</Link>
      </div>
    )
  }

  const dayNum = dateDaysSince(activeBaby.date_of_birth)
  const todayLogs = logs.filter(l => {
    const d = new Date(l.logged_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  const targetFeeds = activeBaby.care_plan === 'hydronephrosis' ? 10 : 8
  const targetWet   = activeBaby.care_plan === 'hydronephrosis' ? 8 : 6

  const statCards = [
    { label: 'Feeds',  done: stats?.feed_count ?? 0,   of: targetFeeds, unit: '', color: 'sage',   icon: Bottle },
    { label: 'Wet',    done: stats?.wet_count ?? 0,    of: targetWet,   unit: '', color: 'sky',    icon: Drop },
    { label: 'Soiled', done: stats?.soiled_count ?? 0, of: 2,           unit: '', color: 'butter', icon: Diaper },
    { label: 'Sleep',  done: Math.round((stats?.sleep_minutes ?? 0) / 60), of: 16, unit: 'h', color: 'rose', icon: Moon },
  ]

  const isGoodDay = (stats?.feed_count ?? 0) >= Math.floor(targetFeeds * 0.6) && (stats?.wet_count ?? 0) >= Math.floor(targetWet * 0.6)

  return (
    <div className="page-pad">
      {/* Hero status card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--sage-bg) 0%, var(--cream-2) 100%)',
        borderRadius: 28, padding: '22px 22px 20px',
        marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              <Sun size={11} color="var(--sage-d)" /> <span style={{ verticalAlign: 'middle' }}>day {dayNum} · {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()}</span>
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, lineHeight: 1.1, margin: '6px 0 0' }}>
              {loading ? 'Loading…' : isGoodDay
                ? <>Today is <span className="wavy-underline">going</span><br/>well.</>
                : <>Keep it up —<br/>{activeBaby.name} needs you.</>
              }
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.45, maxWidth: 260 }}>
              {activeBaby.name} · {activeBaby.care_plan === 'hydronephrosis' ? 'Hydronephrosis care plan' : 'Standard care plan'}
            </p>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: 26,
            background: isGoodDay ? 'var(--sage)' : 'var(--apricot)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: `0 6px 16px ${isGoodDay ? 'rgba(122,155,126,0.4)' : 'rgba(232,168,124,0.4)'}`,
          }}>
            {isGoodDay ? <Check size={26} color="white" /> : <span style={{ fontSize: 24 }}>💪</span>}
          </div>
        </div>
        {/* Mini progress bars */}
        <div style={{ display: 'flex', gap: 6 }}>
          {statCards.map(s => {
            const pct = Math.min(100, (s.done / s.of) * 100)
            return (
              <div key={s.label} style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: `var(--${s.color}-d, var(--sage-d))` }}/>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4, fontWeight: 600 }}>
                  {s.done}/{s.of}{s.unit} {s.label.toLowerCase()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
        {statCards.map(s => {
          const Icon = s.icon
          const bgVar = `var(--${s.color}-bg)`
          const fgVar = s.color === 'sage' ? 'var(--sage-d)' : s.color === 'sky' ? '#4A6B7C' : s.color === 'butter' ? '#8E6E2E' : '#8E5454'
          return (
            <div key={s.label} style={{
              background: 'var(--paper)', borderRadius: 18, padding: '14px 14px',
              border: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: bgVar, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={fgVar} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500 }}>
                {s.done}<span style={{ fontSize: 14, color: 'var(--ink-mute)', fontWeight: 400 }}>/{s.of}{s.unit}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Today's timeline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: 0 }}>Today's timeline</h3>
        <Link to="/stats" style={{ fontSize: 12, color: 'var(--sage-d)', fontWeight: 600, textDecoration: 'none' }}>History →</Link>
      </div>

      {todayLogs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 24px',
          background: 'var(--paper)', borderRadius: 18, border: '1px dashed var(--ink-faint)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🍼</div>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>No logs yet today — tap Quick log to start.</p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 9, top: 12, bottom: 12, borderLeft: '2px dashed var(--ink-faint)' }}/>
          {todayLogs.map((e, i) => {
            const c = COLOR_MAP[e.log_type as keyof typeof COLOR_MAP] ?? { bg: 'var(--cream-2)', fg: 'var(--ink-soft)', label: e.log_type }
            const isNow = i === 0
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: -28, top: 8,
                  width: 20, height: 20, borderRadius: 10,
                  background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--cream)',
                }}>
                  <LogIcon type={e.log_type} size={11} color={c.fg} />
                </div>
                <div style={{
                  flex: 1, padding: '10px 14px', background: 'var(--paper)', borderRadius: 14,
                  border: isNow ? `1.5px solid ${c.fg}` : '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                      {e.amount_ml ? `${e.amount_ml} ml` : ''}
                      {e.detail ? (e.amount_ml ? ' · ' : '') + e.detail : ''}
                      {e.duration_min ? ` · ${e.duration_min} min` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    {isNow && <span className="chip sage" style={{ padding: '2px 7px', fontSize: 9 }}>just now</span>}
                    <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
                      {dayLabel(new Date(e.logged_at))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating log button */}
      <Link to="/log" style={{
        position: 'fixed', right: 22, bottom: 90,
        width: 60, height: 60, borderRadius: 30,
        background: 'var(--sage)', color: 'white', textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(122,155,126,0.5), 0 2px 4px rgba(0,0,0,0.08)',
        zIndex: 40,
      }} className="mobile-only pulse">
        <Plus size={26} color="white" />
      </Link>
    </div>
  )
}
