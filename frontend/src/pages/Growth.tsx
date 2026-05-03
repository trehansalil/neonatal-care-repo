import { useEffect, useState } from 'react'
import { growthApi, babiesApi } from '../api'
import type { GrowthRecord } from '../api/types'
import { useBaby } from '../contexts/BabyContext'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Trash } from '../components/Icons'

export default function Growth() {
  const { activeBaby, reload: reloadBabies } = useBaby()
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ recorded_at: new Date().toISOString().split('T')[0], weight_kg: '', length_cm: '', head_cm: '' })

  useEffect(() => {
    if (!activeBaby) return
    setLoading(true)
    growthApi.list(activeBaby.id).then(r => setRecords(r.data)).finally(() => setLoading(false))
  }, [activeBaby?.id])

  const handleAdd = async () => {
    if (!activeBaby) return
    try {
      const r = await growthApi.create(activeBaby.id, {
        recorded_at: form.recorded_at,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        length_cm: form.length_cm ? parseFloat(form.length_cm) : undefined,
        head_cm: form.head_cm ? parseFloat(form.head_cm) : undefined,
      })
      setRecords(prev => [...prev, r.data].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)))
      if (form.weight_kg && activeBaby) {
        await babiesApi.update(activeBaby.id, { current_weight_kg: parseFloat(form.weight_kg) })
        await reloadBabies()
      }
      setShowAdd(false)
      setForm({ recorded_at: new Date().toISOString().split('T')[0], weight_kg: '', length_cm: '', head_cm: '' })
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: number) => {
    if (!activeBaby) return
    await growthApi.delete(activeBaby.id, id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const chartData = records.filter(r => r.weight_kg).map((r, i) => ({
    week: `w${i}`,
    kg: r.weight_kg,
    date: r.recorded_at,
  }))

  const latestWeight = records.filter(r => r.weight_kg).slice(-1)[0]?.weight_kg
  const birthWeight  = activeBaby?.birth_weight_kg ?? 0
  const gainPct = latestWeight && birthWeight ? ((latestWeight - birthWeight) / birthWeight * 100).toFixed(0) : null

  return (
    <div className="page-pad">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--sage-d)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
          Growth
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
          {latestWeight ? (
            <>{latestWeight.toFixed(2)} kg <span style={{ color: 'var(--sage-d)', fontSize: 22 }}>
              {gainPct && parseInt(gainPct) > 0 ? `↑ ${gainPct}%` : ''}
            </span></>
          ) : 'Growth tracker.'}
        </h1>
        {latestWeight && birthWeight && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>
            since <span className="wavy-underline">birth</span>
          </p>
        )}
      </div>

      {/* Add button */}
      <button onClick={() => setShowAdd(s => !s)} className="btn btn-soft" style={{ marginBottom: 18, width: '100%', justifyContent: 'center' }}>
        <Plus size={16} /> Add measurement
      </button>

      {showAdd && (
        <div style={{ background: 'var(--paper)', borderRadius: 16, padding: '16px', border: '1px solid var(--line)', marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.recorded_at} onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input className="input" type="number" step="0.01" placeholder="e.g. 3.50" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
            </div>
            <div>
              <label className="label">Length (cm)</label>
              <input className="input" type="number" step="0.1" placeholder="e.g. 52.0" value={form.length_cm} onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} />
            </div>
            <div>
              <label className="label">Head (cm)</label>
              <input className="input" type="number" step="0.1" placeholder="e.g. 34.5" value={form.head_cm} onChange={e => setForm(f => ({ ...f, head_cm: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={handleAdd} className="btn btn-primary" style={{ flex: 2 }}>Save measurement</button>
          </div>
        </div>
      )}

      {/* Weight chart */}
      {chartData.length > 1 && (
        <div style={{ background: 'var(--paper)', borderRadius: 18, padding: '16px 16px 8px', border: '1px solid var(--line)', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>Weight trend</span>
            <span className="chip sage" style={{ fontSize: 10 }}>kg</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--ink-mute)' }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--ink-mute)' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
                formatter={(v: number) => [`${v?.toFixed(2)} kg`, 'Weight']}
              />
              <Line
                type="monotone" dataKey="kg"
                stroke="var(--sage)" strokeWidth={2.5}
                dot={{ r: 4, fill: 'var(--sage)', stroke: 'white', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Records list */}
      {records.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--paper)', borderRadius: 18, border: '1px dashed var(--ink-faint)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📏</div>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>No measurements yet — add one above.</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '0 0 12px' }}>All measurements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...records].reverse().map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--paper)', borderRadius: 14, border: '1px solid var(--line)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{r.recorded_at}</div>
                  <div style={{ fontSize: 15, marginTop: 2 }}>
                    {r.weight_kg && <span style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>{r.weight_kg.toFixed(2)} kg</span>}
                    {r.length_cm && <span style={{ color: 'var(--ink-mute)', fontSize: 13 }}> · {r.length_cm} cm</span>}
                    {r.head_cm && <span style={{ color: 'var(--ink-mute)', fontSize: 13 }}> · head {r.head_cm} cm</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Trash size={16} color="var(--ink-faint)" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--cream-2)', borderRadius: 14, border: '1px dashed var(--ink-faint)', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--ink-soft)' }}>Note:</strong> These charts are for reference only. Always discuss growth with your pediatrician or nephrologist.
      </div>
    </div>
  )
}
