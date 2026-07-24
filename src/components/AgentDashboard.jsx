import { useMemo, useState } from 'react'
import { computeCascade } from '../lib/commissionCalc'

const STATUSES = ['New', 'Verified', 'Submitted', 'Disbursed', 'Rejected']

function statusCounts(leads) {
  const c = { New: 0, Verified: 0, Submitted: 0, Disbursed: 0, Rejected: 0 }
  leads.forEach(l => { c[l.status] = (c[l.status] || 0) + 1 })
  return c
}

export default function AgentDashboard({ currentAgent, leads, ledger, agents, allAgents, payoutMatrix }) {
  const myLeads = useMemo(() => leads.filter(l => l.generator_agent_id === currentAgent.id), [leads, currentAgent])
  const teamLeads = useMemo(() => leads.filter(l => l.generator_agent_id !== currentAgent.id), [leads, currentAgent])

  const myEarnings = useMemo(() => {
    const mine = ledger.filter(e => e.agent_id === currentAgent.id)
    const pending = mine.filter(e => e.payout_status === 'pending').reduce((s, e) => s + Number(e.amount), 0)
    const due = mine.filter(e => e.payout_status === 'due').reduce((s, e) => s + Number(e.amount), 0)
    const paid = mine.filter(e => e.payout_status === 'paid').reduce((s, e) => s + Number(e.amount), 0)
    return { pending, due, paid, total: pending + due + paid }
  }, [ledger, currentAgent])

  // Forecast: pipeline leads (not yet disbursed/rejected) that would earn this
  // agent something, calculated with the requested amount as an estimate.
  const expected = useMemo(() => {
    const pipeline = leads.filter(l => l.status !== 'Disbursed' && l.status !== 'Rejected')
    let total = 0
    pipeline.forEach(lead => {
      const rows = computeCascade(lead, allAgents || agents, payoutMatrix || [])
      rows.forEach(r => { if (r.agentId === currentAgent.id) total += r.amount })
    })
    return total
  }, [leads, allAgents, agents, payoutMatrix, currentAgent])

  const myCounts = statusCounts(myLeads)
  const teamCounts = statusCounts(teamLeads)
  const directChildren = agents.filter(a => a.parent_agent_id === currentAgent.id)

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Welcome, {currentAgent.name}</h3>

      <InviteLinkBox referralCode={currentAgent.referral_code} />

      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="stat-num">₹{expected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Expected (pipeline, not yet disbursed)</div></div>
        <div className="stat-card"><div className="stat-num">₹{myEarnings.pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Pending (disbursed, not invoiced)</div></div>
        <div className="stat-card"><div className="stat-num">₹{myEarnings.due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Due (invoiced, awaiting payment)</div></div>
        <div className="stat-card"><div className="stat-num">₹{myEarnings.paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Paid</div></div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-num">₹{myEarnings.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Total commission earned to date</div></div>
        <div className="stat-card"><div className="stat-num">{directChildren.length}</div><div className="stat-label">Direct downline agents</div></div>
        <div className="stat-card"><div className="stat-num">{myLeads.length}</div><div className="stat-label">My own leads</div></div>
        <div className="stat-card"><div className="stat-num">{teamLeads.length}</div><div className="stat-label">My team's leads</div></div>
      </div>

      <p style={{ fontSize: 12, color: '#888', marginTop: -14, marginBottom: 20 }}>
        Once a lead is Disbursed, your commission shows as <strong>Pending</strong> — go to the Commissions tab and click
        <strong> Raise invoice</strong> to move it to <strong>Due</strong>. Admin marks it <strong>Paid</strong> once payment is made.
      </p>

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>My own leads ({myLeads.length})</h4>
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {STATUSES.map(s => <tr key={s}><td>{s}</td><td>{myCounts[s]}</td></tr>)}
            </tbody>
          </table></div>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>My team's leads ({teamLeads.length})</h4>
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {STATUSES.map(s => <tr key={s}><td>{s}</td><td>{teamCounts[s]}</td></tr>)}
            </tbody>
          </table></div>
        </div>
      </div>

      {teamLeads.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>Team lead detail</h4>
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Customer</th><th>Generated by</th><th>Status</th></tr></thead>
            <tbody>
              {teamLeads.map(l => (
                <tr key={l.id}>
                  <td>{l.customer_name}</td>
                  <td>{l.generator?.name}</td>
                  <td>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}

function InviteLinkBox({ referralCode }) {
  const link = `${window.location.origin}/?apply=true&ref=${referralCode}`
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function shareOnWhatsApp() {
    const message = `Join my team on LoanNexus.in — apply here: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 13 }}>
        <strong>Your invite link</strong> — share this to bring new agents into your team
        <div style={{ color: '#777', fontSize: 12, marginTop: 2, wordBreak: 'break-all' }}>{link}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button className="btn" style={{ background: '#25D366' }} onClick={shareOnWhatsApp}>Share via WhatsApp</button>
        <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
      </div>
    </div>
  )
}
