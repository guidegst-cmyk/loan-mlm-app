import { useState } from 'react'
import {
  createBank, createLoanType, createPayoutRule, updatePayoutRule,
  createAgent, updateAgent, createAgentLogin,
} from '../lib/queries'
import AgentDocumentsPanel from './AgentDocumentsPanel'
import ApplicationsPanel from './ApplicationsPanel'

const SUBTABS = ['Agents', 'Applications', 'Banks & Loan Types', 'Payout Matrix', 'Agent Documents']

export default function MasterData({ agents, banks, loanTypes, payoutMatrix, documentTypes, onRefresh }) {
  const [sub, setSub] = useState('Agents')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {SUBTABS.map(s => (
          <button
            key={s}
            className={sub === s ? 'tab active' : 'tab'}
            style={{ background: sub === s ? '#eef2f6' : 'transparent', borderRadius: 6 }}
            onClick={() => setSub(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {sub === 'Agents' && <AgentsPanel agents={agents} onRefresh={onRefresh} />}
      {sub === 'Applications' && <ApplicationsPanel agents={agents} onRefresh={onRefresh} />}
      {sub === 'Banks & Loan Types' && <BanksLoanTypesPanel banks={banks} loanTypes={loanTypes} onRefresh={onRefresh} />}
      {sub === 'Payout Matrix' && <PayoutMatrixPanel banks={banks} loanTypes={loanTypes} payoutMatrix={payoutMatrix} onRefresh={onRefresh} />}
      {sub === 'Agent Documents' && <AgentDocumentsPanel agents={agents} documentTypes={documentTypes} />}
    </div>
  )
}

function AgentsPanel({ agents, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', parent_agent_id: '', referral_code: '', username: '', password: 'Welcome@123' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const agent = await createAgent({
        name: form.name,
        parent_agent_id: form.parent_agent_id || null,
        referral_code: form.referral_code,
        status: 'active',
      })
      await createAgentLogin(agent.id, form.username || form.referral_code, form.password || 'Welcome@123')
      setForm({ name: '', parent_agent_id: '', referral_code: '', username: '', password: 'Welcome@123' })
      setShowForm(false)
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(agent) {
    try {
      await updateAgent(agent.id, { status: agent.status === 'active' ? 'inactive' : 'active' })
      onRefresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Agents ({agents.length})</h3>
        <button className="btn" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New agent'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ marginBottom: 16 }}>
          <div className="grid2">
            <label>Name
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </label>
            <label>Parent agent (blank = topmost)
              <select value={form.parent_agent_id} onChange={e => setForm(f => ({ ...f, parent_agent_id: e.target.value }))}>
                <option value="">None (topmost)</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>Referral code
              <input required value={form.referral_code} onChange={e => setForm(f => ({ ...f, referral_code: e.target.value }))} placeholder="e.g. AK-021" />
            </label>
            <label>Login username (blank = referral code)
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </label>
            <label>Default password
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </label>
          </div>
          {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Creating…' : 'Create agent + login'}
          </button>
        </form>
      )}

      <div className="table-scroll"><table className="table">
        <thead><tr><th>Name</th><th>Referral code</th><th>Parent</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {agents.map(a => {
            const parent = agents.find(p => p.id === a.parent_agent_id)
            return (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.referral_code}</td>
                <td>{parent?.name || '—'}</td>
                <td>{a.status}</td>
                <td><button className="link" onClick={() => toggleStatus(a)}>{a.status === 'active' ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
    </div>
  )
}

function BanksLoanTypesPanel({ banks, loanTypes, onRefresh }) {
  const [bankName, setBankName] = useState('')
  const [ltName, setLtName] = useState('')
  const [busy, setBusy] = useState(false)

  async function addBank(e) {
    e.preventDefault()
    setBusy(true)
    try { await createBank(bankName); setBankName(''); onRefresh() }
    catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  async function addLoanType(e) {
    e.preventDefault()
    setBusy(true)
    try { await createLoanType(ltName); setLtName(''); onRefresh() }
    catch (err) { alert(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Banks ({banks.length})</h4>
        <form onSubmit={addBank} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input required value={bankName} onChange={e => setBankName(e.target.value)} placeholder="New bank name" style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
          <button className="btn" disabled={busy}>Add</button>
        </form>
        <ul style={{ fontSize: 14, paddingLeft: 18 }}>
          {banks.map(b => <li key={b.id}>{b.name}</li>)}
        </ul>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Loan Types ({loanTypes.length})</h4>
        <form onSubmit={addLoanType} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input required value={ltName} onChange={e => setLtName(e.target.value)} placeholder="New loan type" style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
          <button className="btn" disabled={busy}>Add</button>
        </form>
        <ul style={{ fontSize: 14, paddingLeft: 18 }}>
          {loanTypes.map(l => <li key={l.id}>{l.name}</li>)}
        </ul>
      </div>
    </div>
  )
}

function PayoutMatrixPanel({ banks, loanTypes, payoutMatrix, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ bank_id: '', loan_type_id: '', payout_type: 'percent_of_loan', payout_value: '' })
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bankName = id => banks.find(b => b.id === id)?.name || '—'
  const ltName = id => loanTypes.find(l => l.id === id)?.name || '—'

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createPayoutRule({
        bank_id: form.bank_id, loan_type_id: form.loan_type_id,
        payout_type: form.payout_type, payout_value: Number(form.payout_value), active: true,
      })
      setForm({ bank_id: '', loan_type_id: '', payout_type: 'percent_of_loan', payout_value: '' })
      setShowForm(false)
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(rule) {
    try {
      await updatePayoutRule(rule.id, { payout_value: Number(editValue) })
      setEditingId(null)
      onRefresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function toggleActive(rule) {
    try {
      await updatePayoutRule(rule.id, { active: !rule.active })
      onRefresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Payout matrix ({payoutMatrix.length} rules)</h3>
        <button className="btn" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New rule'}</button>
      </div>

      <p style={{ fontSize: 12, color: '#888' }}>
        Changing a rate here only affects <strong>future</strong> disbursements — leads already marked Disbursed keep their
        already-calculated commission amounts (they're frozen at disbursement time, not recalculated).
      </p>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ marginBottom: 16 }}>
          <div className="grid2">
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
            <label>Payout type
              <select value={form.payout_type} onChange={e => setForm(f => ({ ...f, payout_type: e.target.value }))}>
                <option value="percent_of_loan">% of loan amount</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>Value {form.payout_type === 'percent_of_loan' ? '(%)' : '(₹)'}
              <input required type="number" step="0.01" value={form.payout_value} onChange={e => setForm(f => ({ ...f, payout_value: e.target.value }))} />
            </label>
          </div>
          {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? 'Saving…' : 'Add rule'}
          </button>
        </form>
      )}

      <div className="table-scroll"><table className="table">
        <thead><tr><th>Bank</th><th>Loan type</th><th>Type</th><th>Value</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {payoutMatrix.map(p => (
            <tr key={p.id}>
              <td>{bankName(p.bank_id)}</td>
              <td>{ltName(p.loan_type_id)}</td>
              <td>{p.payout_type === 'percent_of_loan' ? '% of loan' : 'Fixed'}</td>
              <td>
                {editingId === p.id ? (
                  <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ width: 80 }} />
                ) : (
                  p.payout_type === 'percent_of_loan' ? `${p.payout_value}%` : `₹${Number(p.payout_value).toLocaleString('en-IN')}`
                )}
              </td>
              <td>{p.active ? 'Yes' : 'No'}</td>
              <td>
                {editingId === p.id ? (
                  <>
                    <button className="link" onClick={() => saveEdit(p)}>Save</button>
                    <button className="link" onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="link" onClick={() => { setEditingId(p.id); setEditValue(p.payout_value) }}>Edit rate</button>
                    <button className="link" onClick={() => toggleActive(p)}>{p.active ? 'Deactivate' : 'Activate'}</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}
