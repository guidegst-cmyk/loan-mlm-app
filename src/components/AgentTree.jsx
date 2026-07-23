import { getSubtreeIds } from '../lib/queries'

export default function AgentTree({ agents, role, currentAgent }) {
  const isAgent = role === 'agent' && currentAgent

  // For an agent: only their own subtree (self + juniors) is visible as a
  // tree, plus their immediate senior shown separately for context. The
  // rest of the company hierarchy is never sent to the browser at all.
  let visibleAgents = agents
  let immediateSenior = null

  if (isAgent) {
    const subtree = getSubtreeIds(currentAgent.id, agents)
    visibleAgents = agents.filter(a => subtree.has(a.id))
    if (currentAgent.parent_agent_id) {
      immediateSenior = agents.find(a => a.id === currentAgent.parent_agent_id) || null
    }
  }

  const childrenOf = {}
  visibleAgents.forEach(a => {
    const p = a.parent_agent_id || 'root'
    if (!childrenOf[p]) childrenOf[p] = []
    childrenOf[p].push(a)
  })
  const roots = isAgent ? [currentAgent] : visibleAgents.filter(a => !a.parent_agent_id)

  function renderNode(agent, depth) {
    const kids = childrenOf[agent.id] || []
    const isSelf = isAgent && agent.id === currentAgent.id
    return (
      <div key={agent.id} style={{ marginLeft: depth * 20 }}>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', margin: '3px 0', borderRadius: 6,
            border: isSelf ? '1.5px solid #1A3A5C' : '1px solid #ddd',
            background: agent.status === 'inactive' ? '#f5f5f5' : '#fff',
          }}
        >
          <span style={{ fontWeight: isSelf ? 700 : 500 }}>{agent.name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{agent.referral_code}</span>
          {isSelf && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#e6f1fb', color: '#042c53' }}>you</span>}
          {agent.status === 'inactive' && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#fdecea', color: '#c0392b' }}>
              inactive
            </span>
          )}
        </div>
        {kids.map(k => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ fontSize: 14 }}>
      {immediateSenior && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Your immediate senior</div>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', borderRadius: 6, border: '1px dashed #bbb', background: '#fafafa', color: '#666'
            }}
          >
            <span>{immediateSenior.name}</span>
            <span style={{ fontSize: 12, color: '#999' }}>{immediateSenior.referral_code}</span>
          </div>
        </div>
      )}
      {isAgent && <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>You & your team</div>}
      {roots.map(r => renderNode(r, 0))}
    </div>
  )
}
