import { useState, useEffect } from 'react'
import { logsApi } from '../api'
import type { LogEntry } from '../api/types'
import { useBaby } from '../contexts/BabyContext'
import { Bottle, Heart, Drop, Diaper, Moon, Pill, Spark } from '../components/Icons'

interface Tile {
  id: string
  logType: string
  label: string
  detail: string
  color: 'sage' | 'sky' | 'butter' | 'rose' | 'apricot'
  icon: (p: { size: number; color: string }) => JSX.Element
  defaultAmount?: number
}

const TILES: Tile[] = [
  { id: 'feed-bottle',  logType: 'feed_bottle', label: 'Bottle',     detail: '120 ml',  color: 'sage',    icon: Bottle, defaultAmount: 120 },
  { id: 'feed-breast',  logType: 'feed_breast', label: 'Breast',     detail: '15 min',  color: 'sage',    icon: Heart },
  { id: 'wet',          logType: 'wet',          label: 'Wet diaper', detail: 'heavy',   color: 'sky',     icon: Drop },
  { id: 'soiled',       logType: 'soiled',       label: 'Soiled',     detail: 'normal',  color: 'butter',  icon: Diaper },
  { id: 'sleep',        logType: 'sleep_start',  label: 'Sleep',      detail: 'start',   color: 'rose',    icon: Moon },
  { id: 'meds',         logType: 'meds',         label: 'Meds',       detail: 'amox.',   color: 'apricot', icon: Pill },
]

const COLOR_BG: Record<string, string> = {
  sage:    'var(--sage-bg)',    apricot: 'var(--apricot-bg)',
  sky:     'var(--sky-bg)',     rose:    'var(--rose-bg)',
  butter:  'var(--butter-bg)',
}
const COLOR_FG: Record<string, string> = {
  sage: 'var(--sage-d)', sky: '#4A6B7C', butter: '#8E6E2E', rose: '#8E5454', apricot: '#8E5A38',
}
const COLOR_ACC: Record<string, string> = {
  sage: 'var(--sage)', sky: 'var(--sky)', butter: 'var(--butter)', rose: 'var(--rose)', apricot: 'var(--apricot)',
}

function timeSince(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 90) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function logLabel(l: LogEntry) {
  const map: Record<string, string> = {
    feed_bottle: 'Bottle', feed_breast: 'Breast', wet: 'Wet diaper',
    soiled: 'Soiled', sleep_start: 'Sleep start', sleep_end: 'Sleep end', meds: 'Meds',
  }
  return map[l.log_type] ?? l.log_type
}

export default function QuickLog() {
  const { activeBaby } = useBaby()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [recent, setRecent] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!activeBaby) return
    logsApi.list(activeBaby.id, 10).then(r => setRecent(r.data)).catch(() => {})
  }, [activeBaby?.id])

  const handleTap = async (tile: Tile) => {
    if (!activeBaby || confirming) return
    setConfirming(tile.id)
    try {
      const payload: Partial<LogEntry> = { log_type: tile.logType }
      if (tile.defaultAmount) payload.amount_ml = tile.defaultAmount
      if (tile.logType === 'feed_breast') payload.duration_min = 15
      if (tile.detail && !tile.defaultAmount) payload.detail = tile.detail
      const r = await logsApi.create(activeBaby.id, payload)
      setRecent(prev => [r.data, ...prev].slice(0, 10))
    } finally {
      setTimeout(() => setConfirming(null), 600)
    }
  }

  const nextPrediction = recent[0]

  return (
    <div className="page-pad">
      {/* Heading */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
          One tap to log.
        </h1>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Spark size={13} color="var(--sage-d)" />
          <span>Smart defaults from your last 4 days · hold to adjust</span>
        </div>
      </div>

      {/* Big-tap pad */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {TILES.map(tile => {
          const active = confirming === tile.id
          const fg = COLOR_FG[tile.color]
          return (
            <button key={tile.id} onClick={() => handleTap(tile)} style={{
              background: active ? fg : COLOR_BG[tile.color],
              border: 'none', borderRadius: 22,
              padding: '18px 16px',
              display: 'flex', flexDirection: 'column', gap: 6,
              alignItems: 'flex-start', height: 108, cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              transition: 'background 0.2s, transform 0.1s',
              transform: active ? 'scale(0.97)' : 'scale(1)',
              boxShadow: active ? 'none' : '0 1px 0 rgba(0,0,0,0.02), inset 0 0 0 1px rgba(0,0,0,0.02)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: active ? 'rgba(255,255,255,0.2)' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <tile.icon size={19} color={active ? 'white' : fg} />
              </div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: active ? 'white' : 'var(--ink)' }}>{tile.label}</div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.85)' : fg, marginTop: 2 }}>
                  {active ? '✓ logged' : tile.detail}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Next predicted */}
      {nextPrediction && (
        <div style={{
          background: 'var(--cream-2)', borderRadius: 18, padding: '14px 16px',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
          border: '1px dashed var(--ink-faint)',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bottle size={18} color="var(--sage-d)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              last logged · {timeSince(nextPrediction.logged_at)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginTop: 1 }}>
              {logLabel(nextPrediction)}{nextPrediction.amount_ml ? ` · ${nextPrediction.amount_ml} ml` : ''}{nextPrediction.detail ? ` · ${nextPrediction.detail}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Recent log */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Recent</div>
        </div>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--ink-mute)', fontSize: 14 }}>
            Nothing logged yet today — tap a tile above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(l => {
              const tileColor = {
                feed_bottle: 'sage', feed_breast: 'sage', wet: 'sky',
                soiled: 'butter', sleep_start: 'rose', sleep_end: 'rose', meds: 'apricot',
              }[l.log_type] ?? 'sage'
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 14,
                  background: 'var(--paper)', border: '1px solid var(--line)',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: COLOR_ACC[tileColor], flexShrink: 0 }}/>
                  <div style={{ flex: 1, fontSize: 14 }}>
                    <span style={{ fontWeight: 500 }}>{logLabel(l)}</span>
                    {l.amount_ml && <span style={{ color: 'var(--ink-mute)' }}> · {l.amount_ml} ml</span>}
                    {l.detail && <span style={{ color: 'var(--ink-mute)' }}> · {l.detail}</span>}
                    {l.duration_min && <span style={{ color: 'var(--ink-mute)' }}> · {l.duration_min} min</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {timeSince(l.logged_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
