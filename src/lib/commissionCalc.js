// Mirrors the SQL commission engine (recompute_commission_for_lead) so we
// can preview "expected" commission client-side for leads that haven't
// been disbursed yet (where no commission_ledger rows exist).

export function getUplineChain(agentId, agents) {
  const byId = {}
  agents.forEach(a => { byId[a.id] = a })
  const chain = []
  let cur = agentId
  const seen = new Set()
  while (cur && byId[cur] && !seen.has(cur)) {
    chain.push(cur)
    seen.add(cur)
    cur = byId[cur].parent_agent_id
  }
  return chain
}

export function calculateD(lead, payoutMatrix) {
  const effectiveAmount = lead.disbursed_amount || lead.loan_amount || 0
  const rule = payoutMatrix.find(p => p.bank_id === lead.bank_id && p.loan_type_id === lead.loan_type_id && p.active)
  if (!rule) return 0
  const bankPayout = rule.payout_type === 'percent_of_loan'
    ? (rule.payout_value / 100) * Number(effectiveAmount)
    : Number(rule.payout_value)
  return bankPayout + Number(lead.client_charge || 0)
}

// Returns array of { agentId (null = company), level, role, amount }
export function computeCascade(lead, agents, payoutMatrix) {
  const D = calculateD(lead, payoutMatrix)
  if (!D) return []

  const chain = getUplineChain(lead.generator_agent_id, agents)
  const chainLen = chain.length
  const results = []

  const genGross = round2(0.6 * D)
  let remaining = D - genGross

  const generatorId = lead.generator_agent_id
  const handledBy = lead.case_handled_by

  if (handledBy && handledBy !== generatorId) {
    const handlerShare = round2(0.2 * genGross)
    results.push({ agentId: generatorId, level: 1, role: 'generator', amount: genGross - handlerShare })
    results.push({ agentId: handledBy, level: 1, role: 'handler', amount: handlerShare })
  } else if (!handledBy) {
    const handlerShare = round2(0.2 * genGross)
    results.push({ agentId: generatorId, level: 1, role: 'generator', amount: genGross - handlerShare })
    results.push({ agentId: null, level: 1, role: 'company', amount: handlerShare })
  } else {
    results.push({ agentId: generatorId, level: 1, role: 'generator', amount: genGross })
  }

  if (chainLen > 1) {
    for (let i = 1; i < chainLen; i++) {
      const isTop = i === chainLen - 1
      const commission = isTop ? round2(remaining) : round2(0.6 * remaining)
      results.push({ agentId: chain[i], level: i + 1, role: 'senior', amount: commission })
      remaining -= commission
    }
  } else {
    results.push({ agentId: null, level: 2, role: 'company', amount: round2(remaining) })
  }

  return results
}

function round2(n) {
  return Math.round(n * 100) / 100
}
