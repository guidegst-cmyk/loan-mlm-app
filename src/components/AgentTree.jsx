import { useState } from 'react'

const ORG_ID = '__org__'

export default function AgentTree({ agents, role, currentAgent }) {
  const isAgent = role === 'agent' && currentAgent
  const realRoots = agents.filter(a => !a.parent_agent_id)
  const hasMultipleRoots = realRoots.length > 1

  const defaultFocusId = isAgent
    ? currentAgent.id
    : (hasMultipleRoots ? ORG_ID : (realRoots[0]?.id || null))

  const [focusId, setFocusId] = useState(defaultFocusId)
  const [history, setHistory] = useState([])

  const byId = {}
  agents.forEach(a => { byId[a.id] = a })

  function getChildren(id) {
    if (id === ORG_ID) return realRoots
    return agents.filter(a => a.parent_agent_id === id)
  }
  function getParentId(id) {
    if (id === ORG_ID) return null
    const a = byId[id]
    if (!a) return null
    if (a.parent_agent_id) return a.parent_agent_id
    // this agent is itself a root — its "parent" is the virtual org node,
    // but never surface that to an agent (only admins should see it)
    return (!isAgent && hasMultipleRoots) ? ORG_ID : null
  }

  const focus = focusId === ORG_ID ? { id: ORG_ID, name: 'Organization', referral_code: '', isOrg: true } : byId[focusId]
  const children = focus ? getChildren(focus.id) : []
  const parentId = focus ? getParentId(focus.id) : null
  const parentNode = parentId ? (parentId === ORG_ID ? { id: ORG_ID, name: 'Organization', isOrg: true } : byId[parentId]) : null

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

  const canGoBack = history.length > 0

  return (
    <div>
      {canGoBack && (
        <button className="btn" style={{ background: '#3a5a7c', marginBottom: 20 }} onClick={goBack}>
          ← Back
        </button>
      )}

      <div className="org-chart">
        {parentNode && (
          <>
            <div className={`org-node org-node-parent ${parentNode.isOrg ? 'org-node-org' : ''}`}>
              <div className="org-node-name">{parentNode.isOrg ? '🏢 Organization' : parentNode.name}</div>
              {!parentNode.isOrg && <div className="org-node-code">{parentNode.referral_code}</div>}
              {isAgent && focus.id === currentAgent.id && (
                <div className="org-node-hint" style={{ color: '#999' }}>your immediate senior</div>
              )}
            </div>
            <div className="org-connector-down" />
          </>
        )}

        <div className={`org-node org-node-focus ${focus.isOrg ? 'org-node-org' : ''}`}>
          <div className="org-node-name">{focus.isOrg ? '🏢 Organization' : focus.name}</div>
          {!focus.isOrg && <div className="org-node-code">{focus.referral_code}</div>}
          {isAgent && focus.id === currentAgent.id && <div className="org-node-hint">you</div>}
          {!focus.isOrg && focus.status === 'inactive' && <span className="badge status-Rejected" style={{ marginTop: 4 }}>inactive</span>}
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
          <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginTop: 20 }}>
            No downline under {focus.isOrg ? 'the organization' : focus.name}.
          </p>
        )}
      </div>
    </div>
  )
}
