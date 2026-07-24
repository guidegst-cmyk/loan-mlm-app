import { useEffect, useMemo, useState } from 'react'
import { createNotification, fetchNotifications, getSubtreeIds } from '../lib/queries'

export default function Notifications({ role, currentAgent, agents, onRefreshTick }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', target_type: 'all', target_agent_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setItems(await fetchNotifications()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [onRefreshTick])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createNotification({
        title: form.title, message: form.message,
        target_type: form.target_type,
        target_agent_id: form.target_type === 'all' ? null : form.target_agent_id,
      })
      setForm({ title: '', message: '', target_type: 'all', target_agent_id: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // For an agent, only show notifications actually targeted to them
  const visibleItems = useMemo(() => {
    if (role === 'admin') return items
    if (!currentAgent) return []
    return items.filter(n => {
      if (n.target_type === 'all') return true
      if (n.target_type === 'individual') return n.target_agent_id === currentAgent.id
      if (n.target_type === 'team') {
        const subtree = getSubtreeIds(n.target_agent_id, agents)
        return subtree.has(currentAgent.id)
      }
      return false
    })
  }, [items, role, currentAgent, agents])

  function targetLabel(n) {
    if (n.target_type === 'all') return 'Everyone'
    if (n.target_type === 'individual') return `Individual: ${n.agents?.name || '—'}`
    if (n.target_type === 'team') return `Team: ${n.agents?.name || '—'} + downline`
    return ''
  }

  if (loading) return <p>Loading notifications…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{role === 'admin' ? `Notifications (${items.length})` : `Your notifications (${visibleItems.length})`}</h3>
        {role === 'admin' && (
          <button className="btn" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New notification'}</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ marginBottom: 16 }}>
          <div className="grid2">
            <label className="field full" style={{ gridColumn: '1/-1' }}>Title
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </label>
            <label style={{ gridColumn: '1/-1' }}>Message
              <textarea required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit' }} />
            </label>
            <label>Send to
              <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value, target_agent_id: '' }))}>
                <option value="all">Everyone</option>
                <option value="team">A specific team (agent + their downline)</option>
                <option value="individual">One specific agent</option>
              </select>
            </label>
            {form.target_type !== 'all' && (
              <label>{form.target_type === 'team' ? 'Team lead' : 'Agent'}
                <select required value={form.target_agent_id} onChange={e => setForm(f => ({ ...f, target_agent_id: e.target.value }))}>
                  <option value="">Select agent</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Sending…' : 'Send notification'}
          </button>
        </form>
      )}

      {visibleItems.length === 0 && <p style={{ color: '#777', fontSize: 13 }}>No notifications yet.</p>}

      {visibleItems.map(n => (
        <div key={n.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <strong>{n.title}</strong>
              <p style={{ fontSize: 14, color: '#444', marginTop: 6, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{n.message}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#999' }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              {role === 'admin' && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{targetLabel(n)}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
