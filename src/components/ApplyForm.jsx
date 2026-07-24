import { useState } from 'react'
import { submitAgentApplication } from '../lib/queries'

export default function ApplyForm({ prefillRef, onDone }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    referral_code_entered: prefillRef || '',
    desired_username: '', password: '', confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password should be at least 6 characters')
      return
    }
    setBusy(true)
    try {
      await submitAgentApplication({
        name: form.name, phone: form.phone, email: form.email,
        referral_code_entered: form.referral_code_entered,
        desired_username: form.desired_username,
        password: form.password,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9' }}>
        <div className="card" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <h2 style={{ color: '#1A3A5C' }}>Application submitted</h2>
          <p style={{ color: '#555', fontSize: 14 }}>
            Thanks, {form.name}! Your application is pending admin review. You'll be able to log in with the username
            and password you set once it's approved.
          </p>
          <button className="btn" onClick={onDone}>Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ marginTop: 0, color: '#1A3A5C' }}>Become a Partner</h2>
        <p style={{ fontSize: 13, color: '#777', marginTop: -8 }}>Fill this in — your application will be reviewed before your login is activated.</p>

        <FieldLabel>Full name</FieldLabel>
        <FieldInput required value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />

        <FieldLabel>Phone</FieldLabel>
        <FieldInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />

        <FieldLabel>Email</FieldLabel>
        <FieldInput type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />

        {prefillRef ? (
          <>
            <FieldLabel>Referred by</FieldLabel>
            <div style={{
              width: '100%', padding: 9, border: '1px solid #ddd', borderRadius: 6,
              background: '#f3f4f6', color: '#333', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
            }}>
              🔒 {prefillRef}
            </div>
          </>
        ) : (
          <>
            <FieldLabel>Referral code</FieldLabel>
            <FieldInput value={form.referral_code_entered} onChange={v => setForm(f => ({ ...f, referral_code_entered: v }))} placeholder="e.g. rk-006" />
          </>
        )}

        <FieldLabel>Choose a username (optional — defaults to your referral code once assigned)</FieldLabel>
        <FieldInput value={form.desired_username} onChange={v => setForm(f => ({ ...f, desired_username: v }))} />

        <FieldLabel>Set a password</FieldLabel>
        <FieldInput type="password" required value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />

        <FieldLabel>Confirm password</FieldLabel>
        <FieldInput type="password" required value={form.confirmPassword} onChange={v => setForm(f => ({ ...f, confirmPassword: v }))} />

        {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 10 }}>
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
        <button type="button" className="link" onClick={onDone} style={{ display: 'block', margin: '10px auto 0' }}>
          Already have a login? Sign in
        </button>
      </form>
    </div>
  )
}

function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 }}>{children}</label>
}
function FieldInput({ value, onChange, type = 'text', required, placeholder }) {
  return (
    <input
      type={type} required={required} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: 9, border: '1px solid #ccc', borderRadius: 6 }}
    />
  )
}
