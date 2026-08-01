import { useEffect, useState } from 'react'
import { fetchChecklist, fetchDocuments, uploadDocument, getDocumentUrl, updateSecurityInsurance } from '../lib/queries'

const VEHICLE_LOAN_TYPES = ['Car Loan', 'Two-Wheeler Loan']

export default function LeadDetailModal({ lead, currentAgent, banks, onRefresh, onClose }) {
  const [checklist, setChecklist] = useState([])
  const [docs, setDocs] = useState([])
  const [uploadingFor, setUploadingFor] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [cl, dc] = await Promise.all([fetchChecklist(lead.id), fetchDocuments(lead.id)])
    setChecklist(cl)
    setDocs(dc)
  }

  useEffect(() => { load() }, [lead.id])

  async function handleFile(documentTypeId, file) {
    setBusy(true)
    try {
      await uploadDocument(lead.id, documentTypeId, currentAgent?.id || null, file)
      await load()
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setBusy(false)
      setUploadingFor(null)
    }
  }

  async function view(path) {
    try {
      const url = await getDocumentUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      alert('Could not open document: ' + err.message)
    }
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtMoney = v => v ? `₹${Number(v).toLocaleString('en-IN')}` : '—'
  const uploadedCount = checklist.filter(c => c.is_uploaded).length
  const bankName = id => banks?.find(b => b.id === id)?.name || '—'
  const isVehicleLoan = VEHICLE_LOAN_TYPES.includes(lead.loan_types?.name)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h3 style={{ margin: 0 }}>Lead #{lead.lead_number} — {lead.customer_name}</h3>
            <span className={`badge status-${lead.status === 'Disbursed' ? 'Verified' : lead.status === 'Rejected' ? 'Rejected' : 'Uploaded'}`}>
              {lead.status}
            </span>
          </div>
          <button className="link" onClick={onClose}>Close</button>
        </div>

        {lead.status === 'Rejected' && lead.rejection_reason && (
          <div style={{ background: '#FCEBEB', color: '#501313', padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 }}>
            <strong>Rejection reason:</strong> {lead.rejection_reason}
          </div>
        )}

        <h4 style={{ marginBottom: 4, marginTop: 16 }}>Applicant</h4>
        <div className="grid2" style={{ marginBottom: 4 }}>
          <InfoRow label="Customer">{lead.customer_name}</InfoRow>
          <InfoRow label="Phone">{lead.customer_phone || '—'}</InfoRow>
          <InfoRow label="PAN">{lead.customer_pan || '—'}</InfoRow>
          <InfoRow label="Aadhar">{lead.customer_aadhar || '—'}</InfoRow>
          <InfoRow label="Address" full>{lead.customer_address || '—'}</InfoRow>
        </div>

        {lead.has_co_applicant && (
          <>
            <h4 style={{ marginBottom: 4, marginTop: 16 }}>Co-applicant</h4>
            <div className="grid2" style={{ marginBottom: 4 }}>
              <InfoRow label="Name">{lead.co_applicant_name || '—'}</InfoRow>
              <InfoRow label="PAN">{lead.co_applicant_pan || '—'}</InfoRow>
              <InfoRow label="Aadhar">{lead.co_applicant_aadhar || '—'}</InfoRow>
              <InfoRow label="Address" full>{lead.co_applicant_address || '—'}</InfoRow>
            </div>
          </>
        )}

        <h4 style={{ marginBottom: 4, marginTop: 16 }}>Loan</h4>
        <div className="grid2" style={{ marginBottom: 4 }}>
          <InfoRow label="Lead generator">{lead.generator?.name || '—'}</InfoRow>
          <InfoRow label="Case handled by">{lead.handler?.name || 'Company'}</InfoRow>
          <InfoRow label="Loan type">{lead.loan_types?.name}</InfoRow>
          <InfoRow label="Requested amount">{fmtMoney(lead.loan_amount)}</InfoRow>
          <InfoRow label="Client charge">{fmtMoney(lead.client_charge)}</InfoRow>
          <InfoRow label="Submitted to">
            {lead.submitted_bank_ids?.length ? lead.submitted_bank_ids.map(bankName).join(', ') : '—'}
          </InfoRow>
          <InfoRow label="Final bank">{lead.bank_id ? bankName(lead.bank_id) : '—'}</InfoRow>
          <InfoRow label="Disbursed amount">
            {lead.status === 'Disbursed' && lead.disbursed_amount ? (
              <>
                {fmtMoney(lead.disbursed_amount)}
                {Number(lead.disbursed_amount) !== Number(lead.loan_amount) && (
                  <span style={{ color: '#a32d2d', fontSize: 11, marginLeft: 6 }}>
                    ({Number(lead.disbursed_amount) > Number(lead.loan_amount) ? '+' : ''}
                    ₹{(Number(lead.disbursed_amount) - Number(lead.loan_amount)).toLocaleString('en-IN')} vs requested)
                  </span>
                )}
              </>
            ) : '—'}
          </InfoRow>
          <InfoRow label="Created on">{fmtDate(lead.created_at)}</InfoRow>
          <InfoRow label="Disbursed on">{lead.status === 'Disbursed' ? fmtDate(lead.disbursed_at) : '—'}</InfoRow>
        </div>

        {lead.status === 'Disbursed' && (
          <SecurityInsuranceSection lead={lead} isVehicleLoan={isVehicleLoan} onRefresh={onRefresh} />
        )}

        <h4 style={{ marginBottom: 4, marginTop: 16 }}>Documents ({uploadedCount} of {checklist.length} mandatory uploaded)</h4>
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Document</th><th>Mandatory</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {checklist.map(c => {
              const existing = docs.find(d => d.document_type_id === c.document_type_id && d.status !== 'Rejected')
              return (
                <tr key={c.document_type_id}>
                  <td>{c.document_name}</td>
                  <td>{c.mandatory ? 'Yes' : 'No'}</td>
                  <td>
                    {existing
                      ? <span className={`badge status-${existing.status}`}>{existing.status}</span>
                      : <span className="badge status-missing">Missing</span>}
                  </td>
                  <td>
                    {existing && (
                      <button className="link" onClick={() => view(existing.file_path)}>View</button>
                    )}
                    {uploadingFor === c.document_type_id ? (
                      <input type="file" autoFocus disabled={busy}
                        onChange={e => e.target.files[0] && handleFile(c.document_type_id, e.target.files[0])} />
                    ) : (
                      <button className="link" onClick={() => setUploadingFor(c.document_type_id)}>
                        {existing ? 'Re-upload' : 'Upload'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}

function SecurityInsuranceSection({ lead, isVehicleLoan, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    security_details: lead.security_details || '',
    insurance_insurer: lead.insurance_insurer || '',
    insurance_policy_number: lead.insurance_policy_number || '',
    insurance_cover_amount: lead.insurance_cover_amount || '',
    insurance_vehicle_make_model: lead.insurance_vehicle_make_model || '',
  })

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSecurityInsurance(lead.id, {
        security_details: form.security_details || null,
        insurance_insurer: form.insurance_insurer || null,
        insurance_policy_number: form.insurance_policy_number || null,
        insurance_cover_amount: form.insurance_cover_amount ? Number(form.insurance_cover_amount) : null,
        insurance_vehicle_make_model: form.insurance_vehicle_make_model || null,
      })
      setEditing(false)
      onRefresh && onRefresh()
    } catch (err) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const hasAnyData = lead.security_details || lead.insurance_insurer || lead.insurance_policy_number || lead.insurance_cover_amount

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Security & Insurance</h4>
        {!editing && <button className="link" onClick={() => setEditing(true)}>{hasAnyData ? 'Edit' : 'Add details'}</button>}
      </div>

      {!editing && (
        hasAnyData ? (
          <div className="grid2" style={{ marginTop: 8 }}>
            <InfoRow label="Security details" full>{lead.security_details || '—'}</InfoRow>
            <InfoRow label="Insurer">{lead.insurance_insurer || '—'}</InfoRow>
            <InfoRow label="Policy number">{lead.insurance_policy_number || '—'}</InfoRow>
            <InfoRow label="Cover amount">{lead.insurance_cover_amount ? `₹${Number(lead.insurance_cover_amount).toLocaleString('en-IN')}` : '—'}</InfoRow>
            {isVehicleLoan && <InfoRow label="Vehicle make/model">{lead.insurance_vehicle_make_model || '—'}</InfoRow>}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: '#999', marginTop: 6 }}>No security/insurance details added yet.</p>
        )
      )}

      {editing && (
        <form onSubmit={save} className="card" style={{ marginTop: 8 }}>
          <div className="grid2">
            <label style={{ gridColumn: '1/-1' }}>Security details
              <textarea rows={2} value={form.security_details} onChange={e => setForm(f => ({ ...f, security_details: e.target.value }))}
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit' }} />
            </label>
            <label>Insurer
              <input value={form.insurance_insurer} onChange={e => setForm(f => ({ ...f, insurance_insurer: e.target.value }))} />
            </label>
            <label>Policy number
              <input value={form.insurance_policy_number} onChange={e => setForm(f => ({ ...f, insurance_policy_number: e.target.value }))} />
            </label>
            <label>Cover amount (₹)
              <input type="number" value={form.insurance_cover_amount} onChange={e => setForm(f => ({ ...f, insurance_cover_amount: e.target.value }))} />
            </label>
            {isVehicleLoan && (
              <label>Vehicle make/model
                <input value={form.insurance_vehicle_make_model} onChange={e => setForm(f => ({ ...f, insurance_vehicle_make_model: e.target.value }))} />
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="link" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

function InfoRow({ label, children, full }) {
  return (
    <div style={{ fontSize: 13, gridColumn: full ? '1/-1' : undefined }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  )
}
