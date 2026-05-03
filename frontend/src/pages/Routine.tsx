import { useState, useEffect } from 'react'
import { routineApi } from '../api'
import type { RoutineResponse } from '../api/types'
import { useBaby } from '../contexts/BabyContext'
import { Check, Spark } from '../components/Icons'

export default function Routine() {
  const { activeBaby } = useBaby()
  const [routine, setRoutine] = useState<RoutineResponse | null>(null)
  const [weight, setWeight] = useState(3.5)
  const [loading, setLoading] = useState(false)

  const carePlan = activeBaby?.care_plan ?? 'standard'
  const feedingMethod = activeBaby?.feeding_method ?? 'bottle'

  useEffect(() => {
    if (activeBaby?.current_weight_kg) setWeight(activeBaby.current_weight_kg)
    else if (activeBaby?.birth_weight_kg) setWeight(activeBaby.birth_weight_kg)
  }, [activeBaby])

  useEffect(() => { calculate() }, [weight, carePlan, feedingMethod])

  const calculate = async () => {
    setLoading(true)
    try {
      const r = await routineApi.calculate(weight, carePlan, feedingMethod)
      setRoutine(r.data)
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60

  return (
    <div className="page-pad">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
          {activeBaby?.name || 'Baby'} · {carePlan === 'hydronephrosis' ? 'Hydronephrosis' : 'Standard'} plan
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
          Today's routine.
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>
          Calculated for {weight.toFixed(1)} kg · {routine?.feeds_per_day ?? '…'} feeds/day
        </p>
      </div>

      {/* Weight adjuster */}
      <div className="card-flat" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Adjust weight</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--sage-d)', fontWeight: 500 }}>{weight.toFixed(1)} kg</span>
        </div>
        <input type="range" min="1.5" max="6" step="0.1" value={weight}
          onChange={e => setWeight(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--sage)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
          <span>1.5 kg</span><span>6.0 kg</span>
        </div>
      </div>

      {routine && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span className="chip sage">🍼 {routine.feeds_per_day} feeds/day</span>
            <span className="chip sky">💧 {Math.round(routine.amount_per_feed_ml)} ml/feed</span>
            <span className="chip butter">📊 {Math.round(routine.daily_total_ml)} ml/day</span>
            <span className="chip rose">💦 {routine.wet_goal_per_day}+ wet diapers</span>
          </div>

          {/* Schedule */}
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '0 0 12px' }}>Feed schedule</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {routine.schedule.map((item, i) => {
              const [h, m] = item.time.split(':').map(Number)
              const feedTime = h + m / 60
              const diff = Math.abs(feedTime - currentHour)
              const isNext = diff < routine.interval_hours / 2 && diff > 0
              const isPast = feedTime < currentHour - 0.25

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 16,
                  background: isNext ? 'var(--sage-bg)' : 'var(--paper)',
                  border: isNext ? '1.5px solid var(--sage)' : '1px solid var(--line)',
                  opacity: isPast ? 0.55 : 1,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                    background: isPast ? 'var(--sage)' : isNext ? 'var(--sage)' : 'var(--cream-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isPast && <Check size={11} color="white" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isNext ? 'var(--sage-d)' : 'var(--ink)' }}>
                      {item.time} — {item.label}
                    </div>
                    {item.notes && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{item.notes}</div>}
                  </div>
                  {isNext && <span className="chip sage" style={{ fontSize: 10, padding: '3px 8px' }}>next</span>}
                </div>
              )
            })}
          </div>

          {/* Notes */}
          <div style={{ background: 'var(--cream-2)', borderRadius: 16, padding: '16px 18px', border: '1px dashed var(--ink-faint)' }}>
            <div style={{ fontFamily: 'var(--hand)', fontSize: 17, color: 'var(--sage-d)', marginBottom: 8 }}>
              <Spark size={14} color="var(--sage-d)" /> notes →
            </div>
            {routine.notes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--sage-d)', fontWeight: 700 }}>·</span>{n}
              </div>
            ))}
          </div>
        </>
      )}

      {loading && !routine && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-mute)' }}>Calculating…</div>
      )}
    </div>
  )
}
