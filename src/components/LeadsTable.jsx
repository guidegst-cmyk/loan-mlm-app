import { useMemo, useState } from 'react'
import { createLead, updateLeadStatus, disburseLead, submitLeadToBanks, rejectLead, checkDuplicateByPAN } from '../lib/queries'
import { presetToRange, inRange, DateFilterBar } from '../lib/filters.jsx'
import { computeCascadeFromD, calculateDRange } from '../lib/commissionCalc'

const STATUSES = ['New', 'Verified', 'Submitted', 'Disbursed', 'Rejected']

export default function LeadsTable({ leads, agents, allAgents, banks, loanTypes, payoutMatrix, role, currentAgent, onRefresh, onSelectLead, initialStatusFilter }) {
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'All')
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
    customer_pan: '', customer_aadhar: '', customer_address: '',
    has_co_applicant: false,
    co_applicant_name: '', co_applicant_pan: '', co_applicant_aadhar: '', co_applicant_address: '',
    loan_type_id: '', loan_amount: '', client_charge: 0,
  })
  const [saving, setSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState(null)

  async function checkPan(pan) {
    if (!pan || pan.length < 4) { setDupWarning(null); return }
    try {
      const matches = await checkDuplicateByPAN(pan)
      setDupWarning(matches.length > 0 ? matches : null)
    } catch {
      // non-critical
    }
  }

  // Expected commission RANGE preview — spans the lowest-to-highest payout
  // rate across all banks in the database for this loan type (no bank is
  // picked at lead-creation stage; that happens at Submitted/Disbursed).
  const preview = useMemo(() => {
    if (!form.loan_type_id || !form.generator_agent_id || !form.loan_amount) return null
    const range = calculateDRange(form.loan_type_id, Number(form.loan_amount), Number(form.client_charge) || 0, payoutMatrix || [], null)
    if (!range) return null
    const minRows = computeCascadeFromD(range.min, form.generator_agent_id, form.case_handled_by || null, allAgents || agents)
    const maxRows = computeCascadeFromD(range.max, form.generator_agent_id, form.case_handled_by || null, allAgents || agents)
    // pair up by agentId+level for a combined min-max row
    const combined = minRows.map((r, i) => ({ ...r, minAmount: r.amount, maxAmount: maxRows[i]?.amount ?? r.amount }))
    return { combined, dMin: range.min, dMax: range.max }
  }, [form.loan_type_id, form.generator_agent_id, form.case_handled_by, form.loan_amount, form.client_charge, agents, allAgents, payoutMatrix])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createLead({
        generator_agent_id: form.generator_agent_id,
        case_handled_by: form.case_handled_by || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_pan: form.customer_pan ? form.customer_pan.toUpperCase() : null,
        customer_aadhar: form.customer_aadhar || null,
        customer_address: form.customer_address || null,
        has_co_applicant: form.has_co_applicant,
        co_applicant_name: form.has_co_applicant ? form.co_applicant_name : null,
        co_applicant_pan: form.has_co_applicant ? (form.co_applicant_pan || '').toUpperCase() || null : null,
        co_applicant_aadhar: form.has_co_applicant ? form.co_applicant_aadhar : null,
        co_applicant_address: form.has_co_applicant ? form.co_applicant_address : null,
        loan_type_id: form.loan_type_id,
        loan_amount: form.loan_amount ? Number(form.loan_amount) : null,
        client_charge: Number(form.client_charge) || 0,
      })
      setShowForm(false)
      setDupWarning(null)
      onRefresh()
    } catch (err) {
      alert('Error creating lead: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---------- Disburse modal ----------
  const [disburseFor, setDisburseFor] = useState(null)
  const [disburseAmount, setDisburseAmount] = useState('')
  const [disburseDate, setDisburseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [disburseBankId, setDisburseBankId] = useState('')
  const [disbursing, setDisbursing] = useState(false)

  // ---------- Submit-to-banks modal ----------
  const [submitFor, setSubmitFor] = useState(null)
  const [selectedBanks, setSelectedBanks] = useState([])
  const [submittingBanks, setSubmittingBanks] = useState(false)

  // ---------- Reject modal ----------
  const [rejectFor, setRejectFor] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  async function changeStatus(lead, status) {
    if (status === 'Disbursed') {
      setDisburseFor(lead)
      setDisburseAmount(lead.loan_amount || '')
      setDisburseDate(new Date().toISOString().slice(0, 10))
      setDisburseBankId(lead.bank_id || (lead.submitted_bank_ids?.[0] || ''))
      return
    }
    if (status === 'Submitted') {
      setSubmitFor(lead)
      setSelectedBanks(lead.submitted_bank_ids || [])
      return
    }
    if (status === 'Rejected') {
      setRejectFor(lead)
      setRejectReason('')
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
        bank_id: disburseBankId || null,
      })
      setDisburseFor(null)
      onRefresh()
    } catch (err) {
      alert('Error disbursing lead: ' + err.message)
    } finally {
      setDisbursing(false)
    }
  }

  function toggleBank(bankId) {
    setSelectedBanks(sel => {
      if (sel.includes(bankId)) return sel.filter(id => id !== bankId)
      if (sel.length >= 3) return sel
      return [...sel, bankId]
    })
  }

  async function confirmSubmit(e) {
    e.preventDefault()
    setSubmittingBanks(true)
    try {
      await submitLeadToBanks(submitFor.id, selectedBanks)
      setSubmitFor(null)
      onRefresh()
    } catch (err) {
      alert('Error submitting: ' + err.message)
    } finally {
      setSubmittingBanks(false)
    }
  }

  async function confirmReject(e) {
    e.preventDefault()
    setRejecting(true)
    try {
      await rejectLead(rejectFor.id, rejectReason)
      setRejectFor(null)
      onRefresh()
    } catch (err) {
      alert('Error rejecting: ' + err.message)
    } finally {
      setRejecting(false)
    }
  }

  function bankName(id) { return banks.find(b => b.id === id)?.name || '—' }

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
            <label>Customer PAN
              <input required value={form.customer_pan}
                onChange={e => setForm(f => ({ ...f, customer_pan: e.target.value.toUpperCase() }))}
                onBlur={e => checkPan(e.target.value)}
                placeholder="ABCDE1234F" />
            </label>
            <label>Customer Aadhar
              <input required value={form.customer_aadhar} onChange={e => setForm(f => ({ ...f, customer_aadhar: e.target.value }))} />
            </label>
            <label style={{ gridColumn: '1/-1' }}>Customer address
              <textarea required rows={2} value={form.customer_address}
                onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit' }} />
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

          {dupWarning && (
            <div style={{ background: '#FCEBEB', color: '#501313', padding: 10, borderRadius: 6, marginTop: 10, fontSize: 12.5 }}>
              ⚠ This PAN already has {dupWarning.length} lead(s) in the system: {dupWarning.map(m => `#${m.lead_number} (${m.status}, by ${m.generator?.name || '—'})`).join(', ')}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 12 }}>
            <input type="checkbox" checked={form.has_co_applicant} onChange={e => setForm(f => ({ ...f, has_co_applicant: e.target.checked }))} />
            Has a co-applicant
          </label>

          {form.has_co_applicant && (
            <div className="grid2" style={{ marginTop: 8 }}>
              <label>Co-applicant name
                <input required value={form.co_applicant_name} onChange={e => setForm(f => ({ ...f, co_applicant_name: e.target.value }))} />
              </label>
              <label>Co-applicant PAN
                <input required value={form.co_applicant_pan} onChange={e => setForm(f => ({ ...f, co_applicant_pan: e.target.value.toUpperCase() }))} />
              </label>
              <label>Co-applicant Aadhar
                <input required value={form.co_applicant_aadhar} onChange={e => setForm(f => ({ ...f, co_applicant_aadhar: e.target.value }))} />
              </label>
              <label style={{ gridColumn: '1/-1' }}>Co-applicant address
                <textarea required rows={2} value={form.co_applicant_address}
                  onChange={e => setForm(f => ({ ...f, co_applicant_address: e.target.value }))}
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit' }} />
              </label>
            </div>
          )}

          {preview && (
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginTop: 10, fontSize: 13 }}>
              <strong>Expected commission range</strong>
              <div style={{ color: '#777', fontSize: 11.5, marginTop: 2 }}>
                No bank is picked yet — this spans the lowest-to-highest payout rate across all banks in
                the database for this loan type. It narrows once the lead is Submitted (up to 3 banks), and
                becomes a fixed figure at Disbursement.
              </div>
              <div style={{ marginTop: 6 }}>
                Total distributable payout (D): ₹{preview.dMin.toLocaleString('en-IN', { maximumFractionDigits: 0 })} – ₹{preview.dMax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <table style={{ width: '100%', marginTop: 6, fontSize: 12 }}>
                <tbody>
                  {preview.combined.map((r, i) => {
                    const agentName = r.agentId ? (allAgents || agents).find(a => a.id === r.agentId)?.name : 'Company'
                    return (
                      <tr key={i}>
                        <td style={{ padding: '2px 0' }}>L{r.level} · {agentName} <span style={{ color: '#999' }}>({r.role})</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          ₹{r.minAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} – ₹{r.maxAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
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

      <div className="table-scroll"><table className="table">
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
              <td>
                {l.bank_id
                  ? l.banks?.name
                  : (l.submitted_bank_ids?.length ? `${l.submitted_bank_ids.length} bank(s) submitted` : '—')}
              </td>
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
      </table></div>

      {/* ---------- Submit to banks modal ---------- */}
      {submitFor && (
        <div className="modal-backdrop" onClick={() => setSubmitFor(null)}>
          <form onSubmit={confirmSubmit} className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Submit — {submitFor.customer_name}</h3>
            <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>Select up to 3 banks this file is being submitted to.</p>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
              {banks.map(b => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 13.5 }}>
                  <input type="checkbox" checked={selectedBanks.includes(b.id)}
                    disabled={!selectedBanks.includes(b.id) && selectedBanks.length >= 3}
                    onChange={() => toggleBank(b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>{selectedBanks.length} of 3 selected</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" type="submit" disabled={submittingBanks || selectedBanks.length === 0}>
                {submittingBanks ? 'Saving…' : 'Confirm submission'}
              </button>
              <button type="button" className="link" onClick={() => setSubmitFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Disburse modal ---------- */}
      {disburseFor && (
        <div className="modal-backdrop" onClick={() => setDisburseFor(null)}>
          <form onSubmit={confirmDisburse} className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Disburse — {disburseFor.customer_name}</h3>
            <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
              Requested amount: ₹{disburseFor.loan_amount ? Number(disburseFor.loan_amount).toLocaleString('en-IN') : '—'}
            </p>

            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Final bank</label>
            <select required value={disburseBankId} onChange={e => setDisburseBankId(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, marginBottom: 12 }}>
              <option value="">Select bank</option>
              {(disburseFor.submitted_bank_ids?.length ? disburseFor.submitted_bank_ids : banks.map(b => b.id)).map(id => (
                <option key={id} value={id}>{bankName(id)}</option>
              ))}
            </select>

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

      {/* ---------- Reject modal ---------- */}
      {rejectFor && (
        <div className="modal-backdrop" onClick={() => setRejectFor(null)}>
          <form onSubmit={confirmReject} className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Reject — {rejectFor.customer_name}</h3>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>Rejection reason</label>
            <textarea required rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ background: '#a32d2d' }} type="submit" disabled={rejecting}>{rejecting ? 'Saving…' : 'Confirm rejection'}</button>
              <button type="button" className="link" onClick={() => setRejectFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
