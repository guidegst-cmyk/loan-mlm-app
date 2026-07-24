// All computations are pure functions over already-loaded data (leads,
// commission_ledger, agents) — no extra network calls needed.

export function loanTypeBreakdown(leads, status, loanTypes) {
  const counts = {}
  loanTypes.forEach(lt => { counts[lt.name] = 0 })
  leads.filter(l => l.status === status).forEach(l => {
    const name = l.loan_types?.name
    if (name) counts[name] = (counts[name] || 0) + 1
  })
  // Only return types that actually have at least one lead, sorted desc
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
}

// "Teams" = the direct children of any topmost (root, no parent) agent.
// Each team's performance = aggregated across that agent + their full downline.
export function teamAnalytics(agents, leads, ledger) {
  const roots = agents.filter(a => !a.parent_agent_id)
  const rootIds = new Set(roots.map(r => r.id))
  const teamLeads = agents.filter(a => a.parent_agent_id && rootIds.has(a.parent_agent_id))

  function subtreeIds(rootId) {
    const childrenOf = {}
    agents.forEach(a => {
      const p = a.parent_agent_id
      if (!childrenOf[p]) childrenOf[p] = []
      childrenOf[p].push(a.id)
    })
    const result = new Set([rootId])
    const queue = [rootId]
    while (queue.length) {
      const cur = queue.shift()
      ;(childrenOf[cur] || []).forEach(k => { if (!result.has(k)) { result.add(k); queue.push(k) } })
    }
    return result
  }

  return teamLeads.map(lead => {
    const ids = subtreeIds(lead.id)
    const teamLeadsData = leads.filter(l => ids.has(l.generator_agent_id))
    const disbursed = teamLeadsData.filter(l => l.status === 'Disbursed').length
    const rejected = teamLeadsData.filter(l => l.status === 'Rejected').length
    const commission = ledger.filter(e => e.agent_id && ids.has(e.agent_id)).reduce((s, e) => s + Number(e.amount), 0)
    return {
      teamLeadId: lead.id,
      teamLeadName: lead.name,
      memberCount: ids.size,
      totalLeads: teamLeadsData.length,
      disbursed, rejected,
      totalCommission: commission,
    }
  }).sort((a, b) => b.totalCommission - a.totalCommission)
}

// Per-individual performance across ALL active agents
export function individualPerformance(agents, leads, ledger) {
  return agents.filter(a => a.status === 'active').map(a => {
    const own = leads.filter(l => l.generator_agent_id === a.id)
    const disbursed = own.filter(l => l.status === 'Disbursed').length
    const rejected = own.filter(l => l.status === 'Rejected').length
    const decided = disbursed + rejected // leads with a final outcome
    const rejectionRate = decided > 0 ? rejected / decided : 0
    const commission = ledger.filter(e => e.agent_id === a.id).reduce((s, e) => s + Number(e.amount), 0)
    return {
      agentId: a.id, name: a.name, referralCode: a.referral_code,
      totalLeads: own.length, disbursed, rejected, decided, rejectionRate,
      totalCommission: commission,
    }
  })
}

export function topPerformers(perf, n = 5) {
  return [...perf].sort((a, b) => b.totalCommission - a.totalCommission).filter(p => p.totalCommission > 0).slice(0, n)
}

// Flagged = needs admin attention: high rejection rate (with a minimum sample
// size so one bad case doesn't flag someone), or zero activity at all.
export function flaggedAgents(perf, n = 8) {
  const highRejection = perf.filter(p => p.decided >= 2 && p.rejectionRate >= 0.34)
  const dormant = perf.filter(p => p.totalLeads === 0)
  return [
    ...highRejection.map(p => ({ ...p, reason: `${Math.round(p.rejectionRate * 100)}% rejection rate` })),
    ...dormant.map(p => ({ ...p, reason: 'No leads generated yet' })),
  ].slice(0, n)
}
