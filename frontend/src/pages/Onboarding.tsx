import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { babiesApi, authApi } from '../api'
import { useBaby } from '../contexts/BabyContext'
import { useAuth } from '../contexts/AuthContext'
import { Check, ChevRight, ChevLeft, Drop } from '../components/Icons'

const STEPS = ['Welcome', 'About baby', 'Care & feeding', 'Reminders', 'Done']

const PHOTO_STEPS = [
  'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&h=700&q=80',
  'https://images.unsplash.com/photo-1544776527-68e63addedf7?auto=format&fit=crop&w=900&h=700&q=80',
  'https://images.unsplash.com/photo-1607582544151-b8e9526a6f31?auto=format&fit=crop&w=900&h=700&q=80',
  'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&h=700&q=80',
  'https://images.unsplash.com/photo-1544776527-68e63addedf7?auto=format&fit=crop&w=900&h=700&q=80',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { reload } = useBaby()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    date_of_birth: '',
    birth_weight_kg: 3.0,
    current_weight_kg: 3.0,
    gender: '',
    care_plan: 'standard',
    feeding_method: 'bottle',
    telegram_chat_id: '',
    telegram_notifications: false,
  })

  const update = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const finish = async () => {
    setLoading(true)
    setError('')
    try {
      await babiesApi.create({
        name: form.name || 'My baby',
        date_of_birth: form.date_of_birth || new Date().toISOString().split('T')[0],
        birth_weight_kg: form.birth_weight_kg,
        current_weight_kg: form.current_weight_kg,
        gender: form.gender || undefined,
        care_plan: form.care_plan as 'hydronephrosis' | 'standard',
        feeding_method: form.feeding_method as 'breast' | 'bottle' | 'mixed',
      })
      if (form.telegram_chat_id) {
        await authApi.updateMe({
          telegram_chat_id: form.telegram_chat_id,
          telegram_notifications: form.telegram_notifications,
        })
      }
      await authApi.updateMe({ onboarding_complete: true })
      await Promise.all([reload(), refreshUser()])
      navigate('/today')
    } catch {
      setError('Something went wrong — please try again')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Two-column on desktop */}
      <div style={{ display: 'flex', minHeight: '100dvh' }}>

        {/* Left photo panel — desktop only */}
        <div className="desktop-only" style={{ width: '42%', position: 'relative', flexShrink: 0 }}>
          <img
            src={PHOTO_STEPS[step]}
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
            alt=""
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(45,42,36,0.35) 0%, transparent 30%, transparent 55%, rgba(45,42,36,0.6) 100%)',
          }}/>
          <div style={{ position: 'absolute', top: 32, left: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'white' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.25)',
              }}>
                <Drop size={16} color="white" />
              </div>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>neonate.care</span>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 36, left: 36, right: 60, color: 'white' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              Built by tired parents
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              A calmer way to track the small wins of the first months.
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.92)', maxWidth: 340, lineHeight: 1.5 }}>
              One-tap logging. Smart routine for hydronephrosis. Telegram reminders that just work.
            </p>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          {/* Mobile photo header */}
          <div className="mobile-only" style={{ position: 'relative', height: 220, flexShrink: 0 }}>
            <img src={PHOTO_STEPS[step]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(45,42,36,0.2) 0%, transparent 35%, transparent 65%, var(--cream) 100%)' }}/>
            <div style={{ position: 'absolute', top: 52, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {step > 0
                ? <button onClick={prev} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevLeft size={18} color="var(--ink)" />
                  </button>
                : <div style={{ width: 36 }} />
              }
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                Step {step + 1} of {STEPS.length}
              </span>
              <div style={{ width: 36 }} />
            </div>
            {/* Progress dots */}
            <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 24 : 6, height: 6, borderRadius: 3,
                  background: i <= step ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'width 0.2s',
                }}/>
              ))}
            </div>
          </div>

          {/* Form area */}
          <div style={{ padding: '24px 28px 40px', flex: 1, maxWidth: 520 }}>

            {/* Desktop stepper */}
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: i > step ? 0.45 : 1 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: i < step ? 'var(--sage)' : i === step ? 'var(--ink)' : 'var(--cream-2)',
                    color: i <= step ? 'white' : 'var(--ink-mute)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                  }}>
                    {i < step ? <Check size={12} color="white" /> : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 500, color: i === step ? 'var(--ink)' : 'var(--ink-mute)', whiteSpace: 'nowrap' }}>{s}</span>
                  {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, borderTop: '1px dashed var(--ink-faint)', marginLeft: 4 }}/>}
                </div>
              ))}
            </div>

            <StepContent step={step} form={form} update={update} />

            {error && (
              <div style={{ background: '#fce8e8', color: 'var(--bad)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 16 }}>
                {error}
              </div>
            )}

            {/* Navigation */}
            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
              {step > 0 && step < STEPS.length - 1 && (
                <button onClick={prev} className="btn btn-ghost">
                  <ChevLeft size={16} /> Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {step < STEPS.length - 2 && (
                <button onClick={next} className="btn btn-primary" style={{ padding: '12px 24px' }}>
                  Continue <ChevRight size={16} color="white" />
                </button>
              )}
              {step === STEPS.length - 2 && (
                <button onClick={() => { next(); finish() }} className="btn btn-primary" disabled={loading} style={{ padding: '12px 24px' }}>
                  {loading ? 'Setting up…' : 'Build my routine'} <ChevRight size={16} color="white" />
                </button>
              )}
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'right' }}>
              Always consult your nephrologist for specifics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepContent({ step, form, update }: {
  step: number
  form: Record<string, unknown>
  update: (k: string, v: unknown) => void
}) {
  if (step === 0) return (
    <div className="fade-in">
      <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>Welcome</div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 500, lineHeight: 1.08, margin: '0 0 16px' }}>
        Hey there,<br/><span style={{ color: 'var(--sage-d)' }}>new parent.</span>
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 380 }}>
        neonate.care helps you track feeds, diapers, and sleep with just a tap — built around the specific needs of a baby with hydronephrosis.
      </p>
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { emoji: '🍼', title: 'One-tap logging', sub: 'Log feeds, wet diapers, and sleep in seconds.' },
          { emoji: '💧', title: 'Hydronephrosis-aware', sub: 'Higher fluid targets and output tracking built in.' },
          { emoji: '📊', title: 'Smart routine', sub: 'Weight-based schedule calculated for your baby.' },
          { emoji: '📱', title: 'Telegram alerts', sub: 'Feed reminders and daily summaries on Telegram.' },
        ].map(f => (
          <div key={f.title} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: 'var(--paper)', borderRadius: 14, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 22, lineHeight: 1 }}>{f.emoji}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{f.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (step === 1) return (
    <div className="fade-in">
      <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>About your baby</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 500, lineHeight: 1.1, margin: '0 0 24px' }}>Tell us about them.</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="label">Baby's name</label>
          <input className="input" placeholder="e.g. Mira" value={form.name as string} onChange={e => update('name', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={form.date_of_birth as string} onChange={e => update('date_of_birth', e.target.value)} />
          </div>
          <div>
            <label className="label">Gender (optional)</label>
            <select className="input" value={form.gender as string} onChange={e => update('gender', e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="">Prefer not to say</option>
              <option value="girl">Girl</option>
              <option value="boy">Boy</option>
            </select>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="label" style={{ marginBottom: 0 }}>Birth weight</label>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--sage-d)', fontWeight: 500 }}>{(form.birth_weight_kg as number).toFixed(1)} kg</span>
          </div>
          <input type="range" min="1.5" max="6" step="0.1" value={form.birth_weight_kg as number}
            onChange={e => update('birth_weight_kg', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--sage)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
            <span>1.5 kg</span><span>6.0 kg</span>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="label" style={{ marginBottom: 0 }}>Current weight</label>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--sage-d)', fontWeight: 500 }}>{(form.current_weight_kg as number).toFixed(1)} kg</span>
          </div>
          <input type="range" min="1.5" max="6" step="0.1" value={form.current_weight_kg as number}
            onChange={e => update('current_weight_kg', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--sage)' }} />
        </div>
      </div>
    </div>
  )

  if (step === 2) return (
    <div className="fade-in">
      <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>Care & feeding</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 500, lineHeight: 1.1, margin: '0 0 24px' }}>A few more details.</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">Feeding method</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
            {[
              { id: 'bottle', label: 'Bottle', emoji: '🍼' },
              { id: 'breast', label: 'Breast', emoji: '🤱' },
              { id: 'mixed',  label: 'Mixed',  emoji: '✨' },
            ].map(o => (
              <button key={o.id} type="button" onClick={() => update('feeding_method', o.id)} style={{
                padding: '14px 8px', borderRadius: 14,
                background: form.feeding_method === o.id ? 'var(--ink)' : 'var(--paper)',
                color: form.feeding_method === o.id ? 'var(--cream)' : 'var(--ink-soft)',
                border: form.feeding_method === o.id ? 'none' : '1px solid var(--line)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Care plan</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            {[
              { id: 'hydronephrosis', label: 'Hydronephrosis', sub: 'Frequent feeds · output focus', emoji: '💧' },
              { id: 'standard', label: 'Standard newborn', sub: 'On-demand feeding', emoji: '👶' },
            ].map(o => {
              const active = form.care_plan === o.id
              return (
                <button key={o.id} type="button" onClick={() => update('care_plan', o.id)} style={{
                  padding: '16px 14px', borderRadius: 14, textAlign: 'left',
                  background: active ? 'var(--sage-bg)' : 'var(--paper)',
                  border: active ? '1.5px solid var(--sage)' : '1px solid var(--line)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 20 }}>{o.emoji}</span>
                    {active && <Check size={16} color="var(--sage-d)" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--ink)' : 'var(--ink-soft)' }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.sub}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 3) return (
    <div className="fade-in">
      <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>Telegram reminders</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 500, lineHeight: 1.1, margin: '0 0 12px' }}>Stay in the loop.</h2>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
        Get feed reminders and daily summaries via Telegram — optional, skip anytime.
      </p>
      <div style={{ background: 'var(--paper)', borderRadius: 16, padding: '20px', border: '1px solid var(--line)', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>How to set up:</div>
        <ol style={{ padding: '0 0 0 20px', margin: 0, color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.7 }}>
          <li>Open Telegram and find <strong>@userinfobot</strong></li>
          <li>Send it any message to get your Chat ID</li>
          <li>Paste the ID below</li>
        </ol>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">Your Telegram Chat ID (optional)</label>
        <input className="input" placeholder="e.g. 123456789" value={form.telegram_chat_id as string}
          onChange={e => update('telegram_chat_id', e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.telegram_notifications as boolean}
          onChange={e => update('telegram_notifications', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--sage)' }} />
        <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Enable feed reminders and daily summaries</span>
      </label>
      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-mute)' }}>
        You can always set this up later in Settings. Skip if you're not ready.
      </p>
    </div>
  )

  return (
    <div className="fade-in" style={{ textAlign: 'center', paddingTop: 40 }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, margin: '0 0 12px' }}>You're all set!</h2>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto 32px' }}>
        {(form.name as string) || 'Your baby'}'s routine is being calculated. Let's head to the dashboard.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div className="chip sage">✓ Baby profile created</div>
        <div className="chip sage">✓ Routine calculated</div>
        {(form.telegram_chat_id as string) && <div className="chip sage">✓ Telegram connected</div>}
      </div>
    </div>
  )
}
