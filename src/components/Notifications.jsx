import { useEffect, useMemo, useState } from 'react'
import { createNotification, getSubtreeIds } from '../lib/queries'

export default function Notifications({ role, currentAgent, agents, items, readIds, onRefresh, onMarkRead }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', target_type: 'all', target_agent_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      onRefresh && onRefresh()
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

  // Mark everything currently visible as read once the agent opens this tab
  useEffect(() => {
    if (role !== 'agent' || !currentAgent) return
    const unread = visibleItems.filter(n => !readIds.has(n.id)).map(n => n.id)
    if (unread.length) onMarkRead && onMarkRead(unread)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length])

  function targetLabel(n) {
    if (n.target_type === 'all') return 'Everyone'
    const agentName = n.agents?.name || agents.find(a => a.id === n.target_agent_id)?.name || '—'
    if (n.target_type === 'individual') return `Individual: ${agentName}`
    if (n.target_type === 'team') return `Team: ${agentName} + downline`
    return ''
  }

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
            <label style={{ gridColumn: '1/-1' }}>Title
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

      {visibleItems.map(n => {
        const isUnread = role === 'agent' && !readIds.has(n.id)
        return (
          <div key={n.id} className="card" style={{ marginBottom: 10, borderLeft: isUnread ? '3px solid #1A3A5C' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
              <div>
                <strong>{n.title}</strong>
                {isUnread && <span className="badge status-due" style={{ marginLeft: 8 }}>new</span>}
                <p style={{ fontSize: 14, color: '#444', marginTop: 6, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{n.message}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#999' }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                {role === 'admin' && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{targetLabel(n)}</div>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
