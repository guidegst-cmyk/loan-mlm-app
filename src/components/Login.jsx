import { useState } from 'react'
import { login } from '../lib/auth'

export default function Login({ onLogin, onApply }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await login(username.trim(), password)
      if (!session) {
        setError('Invalid username or password')
      } else {
        onLogin(session)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 340 }}>
        <h2 style={{ marginTop: 0, color: '#1A3A5C' }}>LoanNexus.in</h2>
        <p style={{ fontSize: 13, color: '#777', marginTop: -8 }}>Sign in to continue</p>

        <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Username</label>
        <input
          value={username} onChange={e => setUsername(e.target.value)}
          placeholder="e.g. admin or rs-root"
          style={{ width: '100%', padding: 9, border: '1px solid #ccc', borderRadius: 6, marginBottom: 12 }}
        />

        <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Password</label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: 9, border: '1px solid #ccc', borderRadius: 6, marginBottom: 12 }}
        />

        {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{ fontSize: 12, color: '#999', marginTop: 14, marginBottom: 0 }}>
          Demo credentials — admin: <code>admin</code>, or any agent's referral code (e.g. <code>rs-root</code>, <code>pv-001</code>).
          Default password for everyone: <code>Welcome@123</code>
        </p>

        <button type="button" className="link" onClick={onApply} style={{ display: 'block', margin: '14px auto 0' }}>
          New agent? Apply here
        </button>
      </form>
    </div>
  )
}
