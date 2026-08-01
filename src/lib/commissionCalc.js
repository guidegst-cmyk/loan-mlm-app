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
// New formula: Company always gets a flat 30% of D. The remaining 70%
// (pool) cascades using "topmost absorbs remainder" uniformly at every
// level, including the generator when they have no seniors above them.
export function computeCascadeFromD(D, generatorId, handledBy, agents) {
  if (!D) return []

  const chain = getUplineChain(generatorId, agents)
  const chainLen = chain.length
  const results = []

  const companyAmount = round2(0.3 * D)
  results.push({ agentId: null, level: 0, role: 'company', amount: companyAmount })
  const pool = D - companyAmount

  let remaining = pool
  let l1Commission = 0

  for (let i = 0; i < chainLen; i++) {
    const isTop = i === chainLen - 1
    const commission = isTop ? round2(remaining) : round2(0.6 * remaining)

    if (i === 0) {
      l1Commission = commission
      if (handledBy && handledBy !== generatorId) {
        const handlerShare = round2(0.2 * l1Commission)
        results.push({ agentId: generatorId, level: 1, role: 'generator', amount: l1Commission - handlerShare })
        results.push({ agentId: handledBy, level: 1, role: 'handler', amount: handlerShare })
      } else if (!handledBy) {
        const handlerShare = round2(0.2 * l1Commission)
        results.push({ agentId: generatorId, level: 1, role: 'generator', amount: l1Commission - handlerShare })
        results.push({ agentId: null, level: 1, role: 'company', amount: handlerShare })
      } else {
        results.push({ agentId: generatorId, level: 1, role: 'generator', amount: l1Commission })
      }
    } else {
      results.push({ agentId: chain[i], level: i + 1, role: 'senior', amount: commission })
    }

    remaining -= commission
  }

  return results
}

export function computeCascade(lead, agents, payoutMatrix) {
  const D = calculateD(lead, payoutMatrix)
  return computeCascadeFromD(D, lead.generator_agent_id, lead.case_handled_by, agents)
}

// Range of D across matching payout_matrix rules for a loan type — optionally
// restricted to a set of bank ids (e.g. the up-to-3 banks a lead was submitted to).
// Returns null if no matching rules exist.
export function calculateDRange(loanTypeId, loanAmount, clientCharge, payoutMatrix, bankIds) {
  const rules = payoutMatrix.filter(p =>
    p.active && p.loan_type_id === loanTypeId &&
    (!bankIds || bankIds.length === 0 || bankIds.includes(p.bank_id))
  )
  if (rules.length === 0) return null
  const values = rules.map(r => {
    const bankPayout = r.payout_type === 'percent_of_loan'
      ? (r.payout_value / 100) * Number(loanAmount || 0)
      : Number(r.payout_value)
    return bankPayout + Number(clientCharge || 0)
  })
  return { min: Math.min(...values), max: Math.max(...values) }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// Depth of an agent in the referral tree (root = depth 1). Used to enforce
// the 5-generation structural cap when adding new agents.
export function agentDepth(agentId, agents) {
  return getUplineChain(agentId, agents).length
}
