import { Warning } from '../components/Icons'

const RED_FLAGS = [
  'Temperature above 38°C in a baby under 3 months',
  'No wet diaper in 8+ hours',
  'Baby is unusually limp, pale, or unresponsive',
  'Bulging fontanelle (soft spot on head)',
  'Persistent vomiting — not bringing up feeds',
  'Breathing that is laboured, grunting, or very rapid',
  'Strong-smelling or cloudy urine (possible UTI)',
]

const AMBER_FLAGS = [
  'Fewer than 5 wet diapers in 24 hours',
  'No bowel movement in 5+ days (formula-fed)',
  'Jaundice spreading below the belly button',
  'Baby consistently pulls away during feeds',
  'Weight not recovered to birth weight by day 10–14',
  'Redness, swelling, or discharge at the umbilical stump',
]

const HYDRO_SPECIFIC = [
  'Crying during urination — may signal UTI or obstruction',
  'Sudden change in urine colour (dark, red-tinged)',
  'Swelling or firmness in the abdomen',
  'Missed ultrasound follow-up appointment',
]

export default function Emergency() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Header */}
      <div style={{ background: '#fce8e8', padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: 'var(--bad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Warning size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--bad)' }}>Emergency checklist</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, margin: 0 }}>When to call immediately.</h1>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#5c3030', lineHeight: 1.5, margin: 0 }}>
          When in doubt, call. Your instinct matters. These are not exhaustive — trust your gut.
        </p>

        {/* Emergency call card */}
        <div style={{
          background: 'var(--bad)', borderRadius: 16, padding: '16px 18px', marginTop: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 4 }}>Emergency</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'white', fontFamily: 'var(--serif)' }}>Call 102 / 112</div>
          </div>
          <a href="tel:112" style={{
            background: 'white', color: 'var(--bad)',
            borderRadius: 999, padding: '10px 18px', fontWeight: 700, fontSize: 14,
            textDecoration: 'none',
          }}>
            Call now
          </a>
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 20 }}>
        {/* Red flags */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--bad)' }}/>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--bad)' }}>
              Red flags — call 112 immediately
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RED_FLAGS.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '12px 14px',
                background: '#fce8e8', borderRadius: 12,
                border: '1px solid #f5c5c5',
              }}>
                <span style={{ color: 'var(--bad)', fontWeight: 700, flexShrink: 0 }}>!</span>
                <span style={{ fontSize: 14, color: '#5c3030', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Amber flags */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--warn)' }}/>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--warn)' }}>
              Amber — call your doctor today
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AMBER_FLAGS.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '12px 14px',
                background: '#f5ead9', borderRadius: 12,
                border: '1px solid #e8d0a8',
              }}>
                <span style={{ color: 'var(--warn)', fontWeight: 700, flexShrink: 0 }}>~</span>
                <span style={{ fontSize: 14, color: '#5c3a20', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hydronephrosis-specific */}
        <div style={{ background: 'var(--sky-bg)', borderRadius: 18, padding: '18px 18px', border: '1px solid var(--sky)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>💧</span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, color: '#2a4a58' }}>Hydronephrosis-specific</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HYDRO_SPECIFIC.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#2a4a58', lineHeight: 1.5 }}>
                <span style={{ color: '#4A6B7C', fontWeight: 700, flexShrink: 0 }}>·</span>{f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--cream-2)', borderRadius: 14, border: '1px dashed var(--ink-faint)', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
          This checklist is not a substitute for medical advice. Always follow the guidance of your nephrologist and pediatrician.
        </div>
      </div>
    </div>
  )
}
