import { useState } from 'react'
import { ChevRight, ChevLeft } from '../components/Icons'

const STEPS = [
  {
    title: 'Wash your hands',
    body: '30 seconds with warm soapy water. Dry well.',
    tip: 'Keep nails short to avoid discomfort.',
    emoji: '🧼',
  },
  {
    title: 'Massage gently',
    body: 'Use circular motions, moving toward the nipple. Repeat around the whole breast for 1–2 minutes.',
    tip: 'A warm cloth or shower first helps trigger let-down.',
    emoji: '🤲',
  },
  {
    title: 'C-hold position',
    body: 'Place your thumb above the nipple and fingers below, about 3 cm back from the areola.',
    tip: 'Your thumb and index finger should form a "C" shape.',
    emoji: '🖐️',
  },
  {
    title: 'Press, compress, release',
    body: 'Press toward your chest wall, then gently compress forward — do not squeeze or slide fingers. Release and repeat rhythmically.',
    tip: "You'll see drops first, then a flow after a minute or two.",
    emoji: '💧',
  },
  {
    title: 'Rotate and repeat',
    body: 'Move position every 1–2 minutes to drain different ducts. Continue until flow slows, then switch sides.',
    tip: 'A 10–15 min session each side is typical.',
    emoji: '🔄',
  },
]

export default function HandExpression() {
  const [step, setStep] = useState(0)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Hero photo */}
      <div style={{ position: 'relative', height: 240 }}>
        <img
          src="https://images.unsplash.com/photo-1607582544151-b8e9526a6f31?auto=format&fit=crop&w=1200&h=600&q=80"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(45,42,36,0.3) 0%, transparent 35%, transparent 65%, var(--cream) 100%)' }}/>
        <div style={{ position: 'absolute', top: 52, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="chip" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', fontSize: 12, fontWeight: 600 }}>
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="chip" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}>~10–15 min</span>
        </div>
        {/* Progress */}
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 24 : 6, height: 6, borderRadius: 3,
              background: i <= step ? 'var(--sage)' : 'var(--line)',
              transition: 'width 0.2s', cursor: 'pointer',
            }}/>
          ))}
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
          Hand expression guide
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, lineHeight: 1.1, margin: '0 0 4px' }}>
          A calm <span className="wavy-underline">5-step</span> rhythm.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 24 }}>
          Best when relaxed. A warm shower or thinking of baby helps the let-down.
        </p>

        {/* Current step card */}
        <div style={{
          background: 'var(--paper)', borderRadius: 24, padding: '24px 22px',
          border: '1px solid var(--line)', marginBottom: 16,
        }} className="fade-in">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{STEPS[step].emoji}</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sage-d)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Step {step + 1}
              </div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, margin: 0 }}>{STEPS[step].title}</h2>
            </div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 14px' }}>{STEPS[step].body}</p>
          <div style={{
            background: 'var(--sage-bg)', borderRadius: 12, padding: '10px 14px',
            fontSize: 13, color: 'var(--sage-d)', lineHeight: 1.5,
          }}>
            💡 {STEPS[step].tip}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0} className="btn btn-soft" style={{ flex: 1 }}>
            <ChevLeft size={16} /> Previous
          </button>
          <button onClick={() => setStep(s => Math.min(s + 1, STEPS.length - 1))} disabled={step === STEPS.length - 1} className="btn btn-primary" style={{ flex: 2 }}>
            {step === STEPS.length - 1 ? 'Complete ✓' : <>Next <ChevRight size={16} color="white" /></>}
          </button>
        </div>

        {/* All steps overview */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '28px 0 12px' }}>All steps</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 14, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: i === step ? 'var(--sage-bg)' : i < step ? 'var(--cream-2)' : 'var(--paper)',
              borderLeft: i === step ? '3px solid var(--sage)' : '3px solid transparent',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
              <span style={{ fontSize: 14, fontWeight: i === step ? 600 : 500, color: i === step ? 'var(--sage-d)' : i < step ? 'var(--ink-mute)' : 'var(--ink)' }}>
                {i + 1}. {s.title}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--cream-2)', borderRadius: 14, border: '1px dashed var(--ink-faint)', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
          Consult a lactation consultant if you experience pain or low supply. These steps are general guidance only.
        </div>
      </div>
    </div>
  )
}
