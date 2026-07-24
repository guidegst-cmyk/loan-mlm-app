import { useMemo, useState } from 'react'
import { presetToRange, inRange, DateFilterBar } from '../lib/filters.jsx'
import { getSubtreeIds, raiseInvoice, markPaid } from '../lib/queries'

export default function CommissionLedger({ entries, leads, role, payoutMatrix, agents, currentAgent, onRefresh }) {
  const [openLead, setOpenLead] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function handleRaiseInvoice(id) {
    setBusyId(id)
    try { await raiseInvoice(id); onRefresh && onRefresh() }
    catch (err) { alert('Error: ' + err.message) }
    finally { setBusyId(null) }
  }

  async function handleMarkPaid(id) {
    setBusyId(id)
    try { await markPaid(id); onRefresh && onRefresh() }
    catch (err) { alert('Error: ' + err.message) }
    finally { setBusyId(null) }
  }

  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [viewMode, setViewMode] = useState('team') // 'individual' | 'team'

  const filteredEntries = useMemo(() => {
    const range = presetToRange(preset, customFrom, customTo)
    let result = entries.filter(e => inRange(e.created_at, range))

    const targetId = role === 'admin' ? selectedAgentId : currentAgent?.id
    if (targetId) {
      if (viewMode === 'individual') {
        result = result.filter(e => e.agent_id === targetId)
      } else {
        const subtree = getSubtreeIds(targetId, agents)
        result = result.filter(e => e.agent_id && subtree.has(e.agent_id))
      }
    }
    return result
  }, [entries, preset, customFrom, customTo, selectedAgentId, viewMode, role, currentAgent, agents])

  const total = filteredEntries.reduce((s, e) => s + Number(e.amount), 0)

  const leadsById = useMemo(() => {
    const m = {}
    leads.forEach(l => { m[l.id] = l })
    return m
  }, [leads])

  const payoutByKey = useMemo(() => {
    const m = {}
    payoutMatrix.forEach(p => { m[`${p.bank_id}|${p.loan_type_id}`] = p })
    return m
  }, [payoutMatrix])

  function payoutRateText(lead) {
    if (!lead) return null
    const p = payoutByKey[`${lead.bank_id}|${lead.loan_type_id}`]
    if (!p) return null
    return p.payout_type === 'percent_of_loan'
      ? `${p.payout_value}% of loan (payout master)`
      : `₹${Number(p.payout_value).toLocaleString('en-IN')} fixed (payout master)`
  }

  const groups = useMemo(() => {
    const byLead = {}
    filteredEntries.forEach(e => {
      const key = e.lead_id
      if (!byLead[key]) {
        byLead[key] = { lead_id: key, customer_name: e.leads?.customer_name || '—', rows: [], total: 0 }
      }
      byLead[key].rows.push(e)
      byLead[key].total += Number(e.amount)
    })
    return Object.values(byLead).sort((a, b) => a.customer_name.localeCompare(b.customer_name))
      .map(g => ({ ...g, rows: g.rows.sort((a, b) => a.level - b.level), lead: leadsById[g.lead_id] }))
  }, [filteredEntries, leadsById])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Commission ledger — {groups.length} disbursed lead{groups.length !== 1 ? 's' : ''}</h3>
        <div style={{ fontWeight: 500 }}>Total distributed: ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {role === 'admin' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Agent
            <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}>
              <option value="">All agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {(role !== 'admin' || selectedAgentId) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            View
            <select value={viewMode} onChange={e => setViewMode(e.target.value)}>
              <option value="team">Team (self + juniors)</option>
              <option value="individual">Individual only</option>
            </select>
          </label>
        )}
        <DateFilterBar
          preset={preset} setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
        />
      </div>

      {groups.length === 0 && <p style={{ color: '#777' }}>No disbursed leads yet — commissions appear here once a lead's status is set to Disbursed.</p>}

      {groups.map(g => {
        const isOpen = openLead === g.lead_id
        const lead = g.lead
        return (
          <div key={g.lead_id} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenLead(isOpen ? null : g.lead_id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span>
                <strong>{g.customer_name}</strong>
                <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>{g.rows.length} split{g.rows.length !== 1 ? 's' : ''}</span>
                {lead && (
                  <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>
                    {lead.banks?.name} · {lead.loan_types?.name} · Requested: ₹{lead.loan_amount ? Number(lead.loan_amount).toLocaleString('en-IN') : '—'}
                    {lead.disbursed_amount && Number(lead.disbursed_amount) !== Number(lead.loan_amount) && (
                      <> · Disbursed: ₹{Number(lead.disbursed_amount).toLocaleString('en-IN')}</>
                    )}
                    {lead.client_charge > 0 && <> · Client charge: ₹{Number(lead.client_charge).toLocaleString('en-IN')}</>}
                    {role === 'admin' && payoutRateText(lead) && <> · Rate: {payoutRateText(lead)}</>}
                  </div>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 500 }}>₹{g.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                <span style={{ fontSize: 12, color: '#999' }}>{isOpen ? '▲' : '▼'}</span>
              </span>
            </button>

            {isOpen && (
              <div className="table-scroll"><table className="table" style={{ borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Level</th><th>Agent</th><th>Role</th><th>Amount</th>
                    {role === 'admin' && <th>% of payout</th>}
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {role === 'admin' && lead && payoutByKey[`${lead.bank_id}|${lead.loan_type_id}`] && (() => {
                    const p = payoutByKey[`${lead.bank_id}|${lead.loan_type_id}`]
                    const bankPayout = p.payout_type === 'percent_of_loan'
                      ? (p.payout_value / 100) * Number(lead.disbursed_amount || lead.loan_amount || 0)
                      : Number(p.payout_value)
                    return (
                      <tr style={{ color: '#777', fontSize: 12 }}>
                        <td colSpan={2}>Bank payout ({payoutRateText(lead)})</td>
                        <td colSpan={2}>₹{bankPayout.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        {role === 'admin' && <td></td>}
                        <td></td>
                        <td></td>
                      </tr>
                    )
                  })()}
                  {g.rows.map(e => (
                    <tr key={e.id}>
                      <td>{e.level}</td>
                      <td>{e.agents?.name || 'Company'}</td>
                      <td><span className={`badge role-${e.role}`}>{e.role}</span></td>
                      <td>₹{Number(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      {role === 'admin' && <td>{((Number(e.amount) / g.total) * 100).toFixed(1)}%</td>}
                      <td>
                        <span className={`badge status-${e.payout_status}`}>
                          {e.payout_status}
                        </span>
                      </td>
                      <td>
                        {role === 'agent' && e.payout_status === 'pending' && e.agent_id === currentAgent?.id && (
                          <button className="link" disabled={busyId === e.id} onClick={() => handleRaiseInvoice(e.id)}>
                            {busyId === e.id ? 'Raising…' : 'Raise invoice'}
                          </button>
                        )}
                        {role === 'admin' && e.payout_status === 'due' && (
                          <button className="link" disabled={busyId === e.id} onClick={() => handleMarkPaid(e.id)}>
                            {busyId === e.id ? 'Saving…' : 'Mark paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 600, background: '#f8f9fa' }}>
                    <td colSpan={3}>Total distributable payout (D)</td>
                    <td>₹{g.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    {role === 'admin' && <td>100%</td>}
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table></div>
            )}
          </div>
        )
      })}
    </div>
  )
}
