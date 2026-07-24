import { useState } from 'react'

export default function AgentTree({ agents, role, currentAgent }) {
  const isAgent = role === 'agent' && currentAgent
  const defaultFocusId = isAgent ? currentAgent.id : (agents.find(a => !a.parent_agent_id)?.id || null)

  const [focusId, setFocusId] = useState(defaultFocusId)
  const [history, setHistory] = useState([])

  const byId = {}
  agents.forEach(a => { byId[a.id] = a })
  const focus = byId[focusId]
  const children = agents.filter(a => a.parent_agent_id === focusId)

  function drillInto(childId) {
    setHistory(h => [...h, focusId])
    setFocusId(childId)
  }
  function goBack() {
    setHistory(h => {
      const copy = [...h]
      const prev = copy.pop()
      setFocusId(prev)
      return copy
    })
  }

  if (!focus) return <p style={{ color: '#777' }}>No agent data.</p>

  // For an agent, they can never navigate above their own position
  const canGoBack = history.length > 0 && (!isAgent || focusId !== currentAgent.id)
  const parentOfFocus = byId[focus.parent_agent_id]

  return (
    <div>
      {canGoBack && (
        <button className="btn" style={{ background: '#3a5a7c', marginBottom: 20 }} onClick={goBack}>
          ← Back
        </button>
      )}

      {!isAgent && parentOfFocus && history.length === 0 && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>Reports to: {parentOfFocus.name}</span>
        </div>
      )}

      <div className="org-chart">
        <div className="org-node org-node-focus">
          <div className="org-node-name">{focus.name}</div>
          <div className="org-node-code">{focus.referral_code}</div>
          {focus.status === 'inactive' && <span className="badge status-Rejected" style={{ marginTop: 4 }}>inactive</span>}
        </div>

        {children.length > 0 && (
          <>
            <div className="org-connector-down" />
            <div className={`org-children-row ${children.length === 1 ? 'single' : ''}`}>
              {children.map(c => (
                <div key={c.id} className="org-child-wrapper">
                  <div className="org-connector-stub" />
                  <button className="org-node org-node-child" onClick={() => drillInto(c.id)}>
                    <div className="org-node-name">{c.name}</div>
                    <div className="org-node-code">{c.referral_code}</div>
                    {c.status === 'inactive' && <span className="badge status-Rejected" style={{ marginTop: 4 }}>inactive</span>}
                    {agents.some(a => a.parent_agent_id === c.id) && (
                      <div className="org-node-hint">{agents.filter(a => a.parent_agent_id === c.id).length} report(s) — click to view</div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {children.length === 0 && (
          <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginTop: 20 }}>No downline under {focus.name}.</p>
        )}
      </div>
    </div>
  )
}
