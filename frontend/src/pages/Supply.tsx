const TIPS = [
  {
    title: 'Nurse or pump every 2–3 hours',
    body: 'Frequent removal is the most reliable way to build and maintain supply. Even 5-minute sessions count.',
    emoji: '🕐',
    color: 'sage',
  },
  {
    title: 'Prioritise hydration',
    body: 'Aim for 2–3 litres of water a day. A large water bottle next to your feeding spot helps.',
    emoji: '💧',
    color: 'sky',
  },
  {
    title: 'Skin-to-skin time',
    body: 'Even 20 minutes of bare skin contact triggers prolactin and oxytocin — the supply hormones.',
    emoji: '🤱',
    color: 'rose',
  },
  {
    title: 'Power pumping',
    body: '1 hour of on-off pumping (20 min on, 10 off, 10 on, 10 off, 10 on) mimics cluster feeding and can boost supply in a few days.',
    emoji: '⚡',
    color: 'apricot',
  },
  {
    title: 'Rest when baby rests',
    body: 'Fatigue suppresses prolactin. Even lying down without sleeping helps. Ask for one night of support a week.',
    emoji: '😴',
    color: 'butter',
  },
]

const colorMap: Record<string, string> = {
  sage:    'var(--sage-bg)',
  sky:     'var(--sky-bg)',
  rose:    'var(--rose-bg)',
  apricot: 'var(--apricot-bg)',
  butter:  'var(--butter-bg)',
}
const fgMap: Record<string, string> = {
  sage: 'var(--sage-d)', sky: '#4A6B7C', rose: '#8E5454', apricot: '#8E5A38', butter: '#8E6E2E',
}

export default function Supply() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img
          src="https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&h=500&q=80"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(45,42,36,0.2) 0%, transparent 40%, var(--cream) 100%)' }}/>
        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, margin: 0, lineHeight: 1.1 }}>
            Supply <span className="wavy-underline">strategies</span>.
          </h1>
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
          For hydronephrosis care, higher fluid intake matters. These gentle strategies help maintain supply so your baby stays well-hydrated.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {TIPS.map((tip, i) => (
            <div key={i} style={{
              background: 'var(--paper)', borderRadius: 20, padding: '18px 18px',
              border: `1px solid var(--line)`,
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: colorMap[tip.color],
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {tip.emoji}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: fgMap[tip.color], marginBottom: 5 }}>{tip.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{tip.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--cream-2)', borderRadius: 16, padding: '16px 18px', border: '1px dashed var(--ink-faint)' }}>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 17, color: 'var(--sage-d)', marginBottom: 8 }}>a note →</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
            If supply drops suddenly or baby seems unsatisfied after feeds, contact your lactation consultant or midwife. Supply challenges are common and solvable with the right support.
          </p>
        </div>
      </div>
    </div>
  )
}
