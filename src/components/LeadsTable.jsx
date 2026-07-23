import { useMemo, useState } from 'react'
import { createLead, updateLeadStatus, disburseLead } from '../lib/queries'
import { presetToRange, inRange, DateFilterBar } from '../lib/filters.jsx'
import { computeCascade } from '../lib/commissionCalc'

const STATUSES = ['New', 'Verified', 'Submitted', 'Disbursed', 'Rejected']

export default function LeadsTable({ leads, agents, allAgents, banks, loanTypes, payoutMatrix, role, currentAgent, onRefresh, onSelectLead }) {
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const filteredLeads = useMemo(() => {
    const range = presetToRange(preset, customFrom, customTo)
    return leads.filter(l => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false
      if (!inRange(l.created_at, range)) return false
      return true
    })
  }, [leads, statusFilter, preset, customFrom, customTo])

  const [form, setForm] = useState({
    generator_agent_id: currentAgent?.id || '',
    case_handled_by: '',
    customer_name: '', customer_phone: '',
    bank_id: '', loan_type_id: '', loan_amount: '', client_charge: 0,
  })
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => {
    if (!form.bank_id || !form.loan_type_id || !form.generator_agent_id || !form.loan_amount) return null
    const fakeLead = {
      generator_agent_id: form.generator_agent_id,
      case_handled_by: form.case_handled_by || null,
      bank_id: form.bank_id,
      loan_type_id: form.loan_type_id,
      loan_amount: Number(form.loan_amount),
      client_charge: Number(form.client_charge) || 0,
    }
    const rows = computeCascade(fakeLead, allAgents || agents, payoutMatrix || [])
    if (rows.length === 0) return null
    const D = rows.reduce((s, r) => s + r.amount, 0)
    return { rows, D }
  }, [form.bank_id, form.loan_type_id, form.generator_agent_id, form.case_handled_by, form.loan_amount, form.client_charge, agents, allAgents, payoutMatrix])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createLead({
        generator_agent_id: form.generator_agent_id,
        case_handled_by: form.case_handled_by || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        bank_id: form.bank_id,
        loan_type_id: form.loan_type_id,
        loan_amount: form.loan_amount ? Number(form.loan_amount) : null,
        client_charge: Number(form.client_charge) || 0,
      })
      setShowForm(false)
      onRefresh()
    } catch (err) {
      alert('Error creating lead: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const [disburseFor, setDisburseFor] = useState(null) // lead object being disbursed
  const [disburseAmount, setDisburseAmount] = useState('')
  const [disburseDate, setDisburseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [disbursing, setDisbursing] = useState(false)

  async function changeStatus(lead, status) {
    if (status === 'Disbursed') {
      setDisburseFor(lead)
      setDisburseAmount(lead.loan_amount || '')
      setDisburseDate(new Date().toISOString().slice(0, 10))
      return
    }
    try {
      await updateLeadStatus(lead.id, status)
      onRefresh()
    } catch (err) {
      alert('Error updating status: ' + err.message)
    }
  }

  async function confirmDisburse(e) {
    e.preventDefault()
    setDisbursing(true)
    try {
      await disburseLead(disburseFor.id, {
        disbursed_amount: disburseAmount ? Number(disburseAmount) : null,
        disbursed_at: new Date(disburseDate).toISOString(),
      })
      setDisburseFor(null)
      onRefresh()
    } catch (err) {
      alert('Error disbursing lead: ' + err.message)
    } finally {
      setDisbursing(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Leads ({filteredLeads.length}{filteredLeads.length !== leads.length ? ` of ${leads.length}` : ''})</h3>
        <button className="btn" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New lead'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Status
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <DateFilterBar
          preset={preset} setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
        />
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ marginBottom: 16 }}>
          <div className="grid2">
            <label>Generator agent
              <select required value={form.generator_agent_id}
                onChange={e => setForm(f => ({ ...f, generator_agent_id: e.target.value }))}
                disabled={role === 'agent'}>
                <option value="">Select agent</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>Case handled by (blank = company)
              <select value={form.case_handled_by} onChange={e => setForm(f => ({ ...f, case_handled_by: e.target.value }))}>
                <option value="">Company</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>Customer name
              <input required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </label>
            <label>Customer phone
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </label>
            <label>Bank
              <select required value={form.bank_id} onChange={e => setForm(f => ({ ...f, bank_id: e.target.value }))}>
                <option value="">Select bank</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label>Loan type
              <select required value={form.loan_type_id} onChange={e => setForm(f => ({ ...f, loan_type_id: e.target.value }))}>
                <option value="">Select loan type</option>
                {loanTypes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label>Loan amount
              <input type="number" value={form.loan_amount} onChange={e => setForm(f => ({ ...f, loan_amount: e.target.value }))} />
            </label>
            <label>Client charge
              <input type="number" value={form.client_charge} onChange={e => setForm(f => ({ ...f, client_charge: e.target.value }))} />
            </label>
          </div>

          {preview && (
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginTop: 10, fontSize: 13 }}>
              <strong>Expected commission (based on requested amount — actual may differ at disbursement)</strong>
              <div style={{ marginTop: 6 }}>
                Total distributable payout (D): ₹{preview.D.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <table style={{ width: '100%', marginTop: 6, fontSize: 12 }}>
                <tbody>
                  {preview.rows.map((r, i) => {
                    const agentName = r.agentId ? (allAgents || agents).find(a => a.id === r.agentId)?.name : 'Company'
                    return (
                      <tr key={i}>
                        <td style={{ padding: '2px 0' }}>L{r.level} · {agentName} <span style={{ color: '#999' }}>({r.role})</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{r.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Saving…' : 'Create lead'}
          </button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Lead #</th><th>Customer</th><th>Generator</th><th>Bank</th><th>Loan type</th>
            <th>Amount</th><th>Status</th><th>Disbursed on</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filteredLeads.map(l => (
            <tr key={l.id}>
              <td><button className="link" onClick={() => onSelectLead(l)}>#{l.lead_number}</button></td>
              <td>{l.customer_name}</td>
              <td>{l.generator?.name}</td>
              <td>{l.banks?.name}</td>
              <td>{l.loan_types?.name}</td>
              <td>{l.loan_amount ? Number(l.loan_amount).toLocaleString('en-IN') : '-'}</td>
              <td>
                <select value={l.status} onChange={e => changeStatus(l, e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td>{l.status === 'Disbursed' && l.disbursed_at ? new Date(l.disbursed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
              <td><button className="link" onClick={() => onSelectLead(l)}>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {disburseFor && (
        <div className="modal-backdrop" onClick={() => setDisburseFor(null)}>
          <form onSubmit={confirmDisburse} className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Disburse — {disburseFor.customer_name}</h3>
            <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
              Requested amount: ₹{disburseFor.loan_amount ? Number(disburseFor.loan_amount).toLocaleString('en-IN') : '—'}
            </p>

            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Disbursed amount (₹)</label>
            <input
              type="number" required value={disburseAmount} onChange={e => setDisburseAmount(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Disbursement date</label>
            <input
              type="date" required value={disburseDate} onChange={e => setDisburseDate(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={disbursing}>{disbursing ? 'Saving…' : 'Confirm disbursement'}</button>
              <button type="button" className="link" onClick={() => setDisburseFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
