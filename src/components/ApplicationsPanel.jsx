import { useEffect, useState } from 'react'
import { fetchAgentApplications, approveAgentApplication, rejectAgentApplication } from '../lib/queries'

export default function ApplicationsPanel({ agents, onRefresh }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [approvingId, setApprovingId] = useState(null)
  const [refCode, setRefCode] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError('')
    try { setApps(await fetchAgentApplications()) }
    catch (err) { setLoadError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function suggestCode(name) {
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
    const n = agents.length + 1
    return `${initials}-${String(n).padStart(3, '0')}`
  }

  async function confirmApprove(app) {
    setBusy(true)
    try {
      await approveAgentApplication(app.id, refCode || suggestCode(app.name))
      setApprovingId(null)
      setRefCode('')
      await load()
      onRefresh && onRefresh()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmReject(app) {
    setBusy(true)
    try {
      await rejectAgentApplication(app.id, reason)
      setRejectingId(null)
      setReason('')
      await load()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const pending = apps.filter(a => a.status === 'Pending')
  const reviewed = apps.filter(a => a.status !== 'Pending')

  if (loading) return <p>Loading applications…</p>
  if (loadError) return <p style={{ color: '#a32d2d' }}>Error loading applications: {loadError}</p>

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Pending applications ({pending.length})</h3>
      {pending.length === 0 && <p style={{ color: '#777', fontSize: 13 }}>No pending applications.</p>}

      {pending.map(app => (
        <div key={app.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <strong>{app.name}</strong>
              <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                {app.phone && <>{app.phone} · </>}{app.email || '—'}
              </div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                Referral entered: {app.referral_code_entered || 'none'}
                {(() => {
                  const parentAgent = agents.find(a => a.id === app.parent_agent_id)
                  return parentAgent ? ` (matched: ${parentAgent.name})` : app.referral_code_entered ? ' — not found' : ''
                })()}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                Submitted {new Date(app.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => { setApprovingId(app.id); setRefCode(suggestCode(app.name)) }}>Approve</button>
              <button className="link" onClick={() => setRejectingId(app.id)}>Reject</button>
            </div>
          </div>

          {approvingId === app.id && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13 }}>Assign referral code:</label>
              <input value={refCode} onChange={e => setRefCode(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 6, width: 140 }} />
              <button className="btn" disabled={busy} onClick={() => confirmApprove(app)}>{busy ? 'Creating…' : 'Confirm approve'}</button>
              <button className="link" onClick={() => setApprovingId(null)}>Cancel</button>
            </div>
          )}

          {rejectingId === app.id && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" style={{ padding: 6, border: '1px solid #ccc', borderRadius: 6, flex: 1 }} />
              <button className="btn" style={{ background: '#a32d2d' }} disabled={busy} onClick={() => confirmReject(app)}>{busy ? 'Saving…' : 'Confirm reject'}</button>
              <button className="link" onClick={() => setRejectingId(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}

      {reviewed.length > 0 && (
        <>
          <h4 style={{ marginTop: 24 }}>Reviewed ({reviewed.length})</h4>
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {reviewed.map(app => (
                <tr key={app.id}>
                  <td>{app.name}</td>
                  <td>{app.status}</td>
                  <td style={{ fontSize: 12, color: '#777' }}>{app.rejection_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
