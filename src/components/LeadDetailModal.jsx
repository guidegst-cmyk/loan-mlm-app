import { useEffect, useState } from 'react'
import { fetchChecklist, fetchDocuments, uploadDocument, getDocumentUrl } from '../lib/queries'

export default function LeadDetailModal({ lead, currentAgent, onClose }) {
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

        <div className="grid2" style={{ marginTop: 16, marginBottom: 4 }}>
          <InfoRow label="Customer">{lead.customer_name}</InfoRow>
          <InfoRow label="Phone">{lead.customer_phone || '—'}</InfoRow>
          <InfoRow label="Lead generator">{lead.generator?.name || '—'}</InfoRow>
          <InfoRow label="Case handled by">{lead.handler?.name || 'Company'}</InfoRow>
          <InfoRow label="Bank">{lead.banks?.name}</InfoRow>
          <InfoRow label="Loan type">{lead.loan_types?.name}</InfoRow>
          <InfoRow label="Requested amount">{fmtMoney(lead.loan_amount)}</InfoRow>
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
          <InfoRow label="Client charge">{fmtMoney(lead.client_charge)}</InfoRow>
          <InfoRow label="Created on">{fmtDate(lead.created_at)}</InfoRow>
          <InfoRow label="Disbursed on">{lead.status === 'Disbursed' ? fmtDate(lead.disbursed_at) : '—'}</InfoRow>
        </div>

        <h4 style={{ marginBottom: 4 }}>Documents ({uploadedCount} of {checklist.length} mandatory uploaded)</h4>
        <table className="table">
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
        </table>
      </div>
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  )
}
