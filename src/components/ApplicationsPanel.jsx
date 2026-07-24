import { useEffect, useState } from 'react'
import { fetchAgentApplications, approveAgentApplication, rejectAgentApplication, fetchApplicationDocuments, getApplicationDocumentUrl } from '../lib/queries'

export default function ApplicationsPanel({ agents, onRefresh }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [approvingId, setApprovingId] = useState(null)
  const [refCode, setRefCode] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [docsByApp, setDocsByApp] = useState({})

  async function load() {
    setLoading(true)
    setLoadError('')
    try { setApps(await fetchAgentApplications()) }
    catch (err) { setLoadError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function toggleExpand(app) {
    const opening = expandedId !== app.id
    setExpandedId(opening ? app.id : null)
    if (opening && !docsByApp[app.id]) {
      try {
        const docs = await fetchApplicationDocuments(app.id)
        setDocsByApp(d => ({ ...d, [app.id]: docs }))
      } catch (err) {
        setDocsByApp(d => ({ ...d, [app.id]: [] }))
      }
    }
  }

  async function viewDoc(path) {
    try {
      const url = await getApplicationDocumentUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      alert('Could not open document: ' + err.message)
    }
  }

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

      {pending.map(app => {
        const isOpen = expandedId === app.id
        const docs = docsByApp[app.id] || []
        return (
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
                <button className="link" style={{ padding: 0, marginTop: 6, fontSize: 12.5 }} onClick={() => toggleExpand(app)}>
                  {isOpen ? 'Hide details' : 'View full details & documents'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { setApprovingId(app.id); setRefCode(suggestCode(app.name)) }}>Approve</button>
                <button className="link" onClick={() => setRejectingId(app.id)}>Reject</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                <div className="grid2" style={{ fontSize: 13, marginBottom: 14 }}>
                  <DetailRow label="Father's name" value={app.father_name} />
                  <DetailRow label="Qualification" value={app.qualification} />
                  <DetailRow label="PAN number" value={app.pan_number} />
                  <DetailRow label="Aadhar number" value={app.aadhar_number} />
                  <DetailRow label="Bank name" value={app.bank_name} />
                  <DetailRow label="Account number" value={app.account_number} />
                  <DetailRow label="IFSC code" value={app.ifsc_code} />
                  <DetailRow label="Present address" value={app.present_address} />
                  <DetailRow label="Permanent address" value={app.permanent_address} />
                </div>

                <h4 style={{ marginBottom: 8, fontSize: 14 }}>Documents ({docs.length})</h4>
                {docs.length === 0 && <p style={{ fontSize: 12, color: '#999' }}>No documents uploaded (or still loading).</p>}
                {docs.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid #f2f2f2' }}>
                    <span>{d.label}</span>
                    <button className="link" onClick={() => viewDoc(d.file_path)}>View</button>
                  </div>
                ))}
              </div>
            )}

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
        )
      })}

      {reviewed.length > 0 && (
        <>
          <h4 style={{ marginTop: 24 }}>Reviewed ({reviewed.length})</h4>
          <div className="table-scroll"><table className="table">
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
          </table></div>
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  )
}
