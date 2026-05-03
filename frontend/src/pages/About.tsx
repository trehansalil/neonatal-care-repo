import { Drop } from '../components/Icons'

export default function About() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 220 }}>
        <img
          src="https://images.unsplash.com/photo-1544776527-68e63addedf7?auto=format&fit=crop&w=1200&h=500&q=80"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(45,42,36,0.25) 0%, transparent 40%, var(--cream) 100%)' }}/>
        <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--sage-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Drop size={18} color="var(--sage-d)" />
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>
              neonate.<span style={{ color: 'var(--sage-d)' }}>care</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
          About
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, lineHeight: 1.1, margin: '0 0 16px' }}>
          Built by <span className="wavy-underline">tired</span> parents.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 28 }}>
          neonate.care was created for parents navigating the first weeks with a newborn diagnosed with hydronephrosis — a condition where one or both kidneys have excess fluid due to a partial blockage of urine flow.
        </p>

        {/* Principles */}
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginBottom: 16 }}>Our principles</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {[
            { emoji: '🎯', title: 'Minimal clicks, maximum insight', body: 'One tap logs a feed. The dashboard tells you how the day is going. No cognitive load when you\'re exhausted.' },
            { emoji: '💧', title: 'Hydronephrosis-first', body: 'Higher fluid targets, output tracking, and UTI awareness built into every feed schedule — not bolted on.' },
            { emoji: '🔒', title: 'Your data, private', body: 'No third-party analytics. Your baby\'s health data stays on your device and our secure server.' },
            { emoji: '🧘', title: 'Calm by design', body: 'Warm colours, readable type, and no alarming red everywhere. You\'re already anxious enough.' },
          ].map(p => (
            <div key={p.title} style={{
              display: 'flex', gap: 14, padding: '16px 18px',
              background: 'var(--paper)', borderRadius: 18, border: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Medical disclaimer */}
        <div style={{ background: 'var(--cream-2)', borderRadius: 18, padding: '20px 20px', border: '1px dashed var(--ink-faint)' }}>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 18, color: 'var(--sage-d)', marginBottom: 8 }}>medical disclaimer →</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0 }}>
            neonate.care is a personal tracking tool. It is <strong>not</strong> a medical device and does not provide medical advice. All feeding schedules, targets, and routines are general references only.
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, margin: '12px 0 0' }}>
            Always follow the guidance of your nephrologist, pediatrician, and medical team. In an emergency, call your local emergency services immediately.
          </p>
        </div>

        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: 'var(--ink-mute)' }}>
          Made with 💚 for the 3am feeds.
        </div>
      </div>
    </div>
  )
}
