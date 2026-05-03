import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBaby } from '../contexts/BabyContext'
import { authApi, telegramApi, babiesApi } from '../api'
import { Telegram, Check, LogOut, Drop } from '../components/Icons'

export default function Settings() {
  const { user, logout, refreshUser } = useAuth()
  const { activeBaby, reload: reloadBabies } = useBaby()
  const navigate = useNavigate()

  const [chatId, setChatId] = useState(user?.telegram_chat_id ?? '')
  const [tgEnabled, setTgEnabled] = useState(user?.telegram_notifications ?? false)
  const [tgStatus, setTgStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [babyWeight, setBabyWeight] = useState(activeBaby?.current_weight_kg ?? activeBaby?.birth_weight_kg ?? 3.0)
  const [babyStatus, setBabyStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTelegram = async () => {
    setTgStatus('saving')
    try {
      if (chatId) {
        await telegramApi.setup(chatId)
      } else {
        await authApi.updateMe({ telegram_notifications: tgEnabled })
      }
      await refreshUser()
      setTgStatus('saved')
      setTimeout(() => setTgStatus('idle'), 2000)
    } catch {
      setTgStatus('error')
      setTimeout(() => setTgStatus('idle'), 3000)
    }
  }

  const saveBaby = async () => {
    if (!activeBaby) return
    setBabyStatus('saving')
    await babiesApi.update(activeBaby.id, { current_weight_kg: babyWeight })
    await reloadBabies()
    setBabyStatus('saved')
    setTimeout(() => setBabyStatus('idle'), 2000)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="page-pad">
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, margin: '0 0 24px' }}>Settings.</h1>

      {/* Profile section */}
      <Section title="Your profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22, background: 'var(--sage-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 18,
          }}>
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.full_name || 'No name set'}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{user?.email}</div>
          </div>
        </div>
      </Section>

      {/* Baby profile */}
      {activeBaby && (
        <Section title="Baby profile">
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>
                {activeBaby.name}'s current weight
              </label>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--sage-d)' }}>
                {babyWeight.toFixed(1)} kg
              </span>
            </div>
            <input type="range" min="1.5" max="8" step="0.1" value={babyWeight}
              onChange={e => setBabyWeight(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--sage)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <span className="chip sage">{activeBaby.care_plan === 'hydronephrosis' ? '💧 Hydronephrosis' : '👶 Standard'}</span>
            <span className="chip">🍼 {activeBaby.feeding_method}</span>
          </div>
          <button onClick={saveBaby} className="btn btn-soft" style={{ marginTop: 12, width: '100%' }} disabled={babyStatus === 'saving'}>
            {babyStatus === 'saved' ? <><Check size={14} color="var(--good)" /> Saved</> : babyStatus === 'saving' ? 'Saving…' : 'Update weight'}
          </button>
        </Section>
      )}

      {/* Telegram */}
      <Section title="Telegram alerts">
        <div style={{ background: 'var(--sage-bg)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
          <Telegram size={18} color="var(--sage-d)" />
          <div style={{ fontSize: 13, color: 'var(--sage-d)', lineHeight: 1.5 }}>
            Get feed reminders and daily summaries via Telegram.
            Find your Chat ID by messaging <strong>@userinfobot</strong>.
          </div>
        </div>
        <label className="label">Telegram Chat ID</label>
        <input className="input" placeholder="e.g. 123456789" value={chatId} onChange={e => setChatId(e.target.value)} style={{ marginBottom: 12 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={tgEnabled} onChange={e => setTgEnabled(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--sage)' }} />
          <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Enable reminders and daily summaries</span>
        </label>
        {tgStatus === 'error' && (
          <div style={{ background: '#fce8e8', color: 'var(--bad)', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
            Couldn't send test message — double-check your Chat ID.
          </div>
        )}
        <button onClick={saveTelegram} className="btn btn-primary" style={{ width: '100%' }} disabled={tgStatus === 'saving'}>
          {tgStatus === 'saved' ? <><Check size={14} color="white" /> Saved & connected!</>
           : tgStatus === 'saving' ? 'Connecting…'
           : tgStatus === 'error' ? 'Try again'
           : <>Save &amp; test connection</>}
        </button>
      </Section>

      {/* App info */}
      <Section title="About the app">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
          <Drop size={16} color="var(--sage-d)" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>neonate.care</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Version 1.0.0</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '12px 0 0' }}>
          Built to help parents of newborns with hydronephrosis stay on top of feeds, output, and growth — with calm, at 3am.
        </p>
      </Section>

      {/* Sign out */}
      <button onClick={handleLogout} className="btn btn-danger btn-full" style={{ marginTop: 8 }}>
        <LogOut size={16} /> Sign out
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-mute)', marginTop: 20 }}>
        Always consult your nephrologist for medical decisions.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
      <div style={{ background: 'var(--paper)', borderRadius: 18, padding: '16px 18px', border: '1px solid var(--line)' }}>
        {children}
      </div>
    </div>
  )
}
