import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Drop } from '../components/Icons'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/today')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Invalid email or password')
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
      {/* Background blobs */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden',
        background: 'radial-gradient(circle at 15% 10%, rgba(200,216,201,0.45) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(232,168,124,0.2) 0%, transparent 45%)',
      }}/>

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        {/* Logo */}
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
            Welcome back.
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px 28px' }}>
          <form onSubmit={handleSubmit}>
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
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
            New here?{' '}
            <Link to="/register" style={{ color: 'var(--sage-d)', fontWeight: 600, textDecoration: 'none' }}>
              Create an account
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-mute)', marginTop: 20 }}>
          Always consult your nephrologist for medical decisions.
        </p>
      </div>
    </div>
  )
}
