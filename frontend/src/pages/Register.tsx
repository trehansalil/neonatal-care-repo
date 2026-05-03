import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Drop } from '../components/Icons'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await register(email, password, name)
      navigate('/onboarding')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Something went wrong — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 18px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 15% 10%, rgba(200,216,201,0.45) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(232,168,124,0.2) 0%, transparent 45%)',
      }}/>

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--sage-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Drop size={24} color="var(--sage-d)" />
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, margin: 0 }}>
            neonate.<span style={{ color: 'var(--sage-d)' }}>care</span>
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', fontSize: 15 }}>
            Create your account — it only takes a moment.
          </p>
        </div>

        <div className="card" style={{ padding: '32px 28px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label className="label">Your name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Priya"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#fce8e8', color: 'var(--bad)',
                borderRadius: 10, padding: '10px 14px', fontSize: 13,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--sage-d)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
