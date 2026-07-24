import { useMemo, useState } from 'react'
import { loanTypeBreakdown, teamAnalytics, individualPerformance, topPerformers, flaggedAgents } from '../lib/dashboardAnalytics'

const STATUSES = ['New', 'Verified', 'Submitted', 'Disbursed', 'Rejected']
const STATUS_COLORS = {
  New: '#5C6B78', Verified: '#2F7DE1', Submitted: '#E08B2E', Disbursed: '#3CA06B', Rejected: '#D45C7A',
}

export default function AdminDashboard({ leads, ledger, agents, loanTypes, stats, onGoToLeads, onGoToCommissions }) {
  const [expandedStatus, setExpandedStatus] = useState(null)

  const teams = useMemo(() => teamAnalytics(agents, leads, ledger), [agents, leads, ledger])
  const perf = useMemo(() => individualPerformance(agents, leads, ledger), [agents, leads, ledger])
  const top = useMemo(() => topPerformers(perf), [perf])
  const flagged = useMemo(() => flaggedAgents(perf), [perf])

  return (
    <div>
      {/* ---------- Money summary ---------- */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-num">{stats.totalLeads}</div><div className="stat-label">Total leads</div></div>
        <div className="stat-card"><div className="stat-num">₹{stats.pendingPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Pending (not yet invoiced)</div></div>
        <div className="stat-card"><div className="stat-num">₹{stats.paidPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div className="stat-label">Paid out</div></div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', borderColor: stats.dueCount > 0 ? '#C89B3C' : undefined }}
          onClick={onGoToCommissions}
        >
          <div className="stat-num" style={{ color: stats.dueCount > 0 ? '#A87F2C' : undefined }}>₹{stats.duePayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Invoiced — awaiting payment ({stats.dueCount})</div>
        </div>
      </div>

      {/* ---------- Status cards with loan-type breakdown ---------- */}
      <h3 style={{ marginBottom: 10 }}>Leads by status</h3>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {STATUSES.map(status => {
          const count = stats.byStatus[status] || 0
          const isOpen = expandedStatus === status
          const breakdown = loanTypeBreakdown(leads, status, loanTypes)
          return (
            <div
              key={status}
              className="stat-card"
              style={{ cursor: 'pointer', borderTop: `3px solid ${STATUS_COLORS[status]}` }}
              onClick={() => setExpandedStatus(isOpen ? null : status)}
            >
              <div className="stat-num" style={{ color: STATUS_COLORS[status] }}>{count}</div>
              <div className="stat-label">{status}</div>

              {isOpen && (
                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
                  {breakdown.length === 0 && <p style={{ fontSize: 12, color: '#999', margin: 0 }}>No leads in this status yet.</p>}
                  {breakdown.map(([name, c]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: '#555' }}>{name}</span>
                      <span style={{ fontWeight: 600 }}>{c}</span>
                    </div>
                  ))}
                  <button className="link" style={{ padding: 0, marginTop: 6, fontSize: 12.5 }} onClick={() => onGoToLeads(status)}>
                    View these leads →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---------- Team-wise analytics ---------- */}
      <h3 style={{ marginBottom: 10 }}>Team performance</h3>
      {teams.length === 0 && <p style={{ color: '#777', fontSize: 13 }}>No teams yet — teams are the direct reports of your topmost agent(s).</p>}
      {teams.length > 0 && (
        <div className="table-scroll" style={{ marginBottom: 24 }}>
          <table className="table">
            <thead><tr><th>Team lead</th><th>Members</th><th>Total leads</th><th>Disbursed</th><th>Rejected</th><th>Total commission</th></tr></thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.teamLeadId}>
                  <td>{t.teamLeadName}</td>
                  <td>{t.memberCount}</td>
                  <td>{t.totalLeads}</td>
                  <td>{t.disbursed}</td>
                  <td>{t.rejected}</td>
                  <td>₹{t.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Individual performance: top + flagged ---------- */}
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Top performers</h4>
          {top.length === 0 && <p style={{ fontSize: 13, color: '#777' }}>No commission activity yet.</p>}
          {top.map((p, i) => (
            <div key={p.agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < top.length - 1 ? '1px solid #eee' : 'none' }}>
              <div>
                <strong style={{ fontSize: 14 }}>{p.name}</strong>
                <div style={{ fontSize: 11.5, color: '#888' }}>{p.disbursed} disbursed · {p.totalLeads} total leads</div>
              </div>
              <div style={{ fontWeight: 600, color: '#1A3A5C' }}>₹{p.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>Flagged — needs attention</h4>
          {flagged.length === 0 && <p style={{ fontSize: 13, color: '#777' }}>Nothing flagged right now.</p>}
          {flagged.map((p, i) => (
            <div key={p.agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < flagged.length - 1 ? '1px solid #eee' : 'none' }}>
              <div>
                <strong style={{ fontSize: 14 }}>{p.name}</strong>
                <div style={{ fontSize: 11.5, color: '#888' }}>{p.totalLeads} total leads · {p.rejected} rejected</div>
              </div>
              <span className="badge status-Rejected">{p.reason}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, marginBottom: 0 }}>
            Flagging rule: ≥34% rejection rate (min. 2 decided leads), or zero leads generated so far.
          </p>
        </div>
      </div>
    </div>
  )
}
