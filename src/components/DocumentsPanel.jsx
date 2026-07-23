import { useEffect, useState } from 'react'
import { fetchChecklist, fetchDocuments, uploadDocument, getDocumentUrl } from '../lib/queries'

export default function DocumentsPanel({ lead, currentAgent, onClose }) {
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

  const uploadedCount = checklist.filter(c => c.is_uploaded).length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{lead.customer_name} — documents</h3>
          <button className="link" onClick={onClose}>Close</button>
        </div>
        <p style={{ color: '#666', fontSize: 13 }}>
          {uploadedCount} of {checklist.length} mandatory documents uploaded
        </p>

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
