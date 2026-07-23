import { useEffect, useState } from 'react'
import { fetchAgentDocuments, uploadAgentDocument, getAgentDocumentUrl } from '../lib/queries'

export default function AgentDocumentsPanel({ agents, documentTypes }) {
  const [agentId, setAgentId] = useState('')
  const [docs, setDocs] = useState([])
  const [uploadingFor, setUploadingFor] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load(id) {
    if (!id) { setDocs([]); return }
    const d = await fetchAgentDocuments(id)
    setDocs(d)
  }

  useEffect(() => { load(agentId) }, [agentId])

  async function handleFile(documentTypeId, file) {
    setBusy(true)
    try {
      await uploadAgentDocument(agentId, documentTypeId, null, file)
      await load(agentId)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setBusy(false)
      setUploadingFor(null)
    }
  }

  async function view(path) {
    try {
      const url = await getAgentDocumentUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      alert('Could not open document: ' + err.message)
    }
  }

  // Only the documents relevant to an agent's own KYC/onboarding
  const relevant = documentTypes.filter(d =>
    ['PAN', 'Aadhar', 'Photo', 'Agent Agreement', 'Other'].includes(d.name)
  )

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Agent documents</h3>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 14 }}>
        Select agent
        <select value={agentId} onChange={e => setAgentId(e.target.value)}>
          <option value="">— choose —</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.referral_code})</option>)}
        </select>
      </label>

      {agentId && (
        <table className="table">
          <thead><tr><th>Document</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {relevant.map(dt => {
              const existing = docs.find(d => d.document_type_id === dt.id && d.status !== 'Rejected')
              return (
                <tr key={dt.id}>
                  <td>{dt.name}</td>
                  <td>
                    {existing
                      ? <span className={`badge status-${existing.status}`}>{existing.status}</span>
                      : <span className="badge status-missing">Missing</span>}
                  </td>
                  <td>
                    {existing && <button className="link" onClick={() => view(existing.file_path)}>View</button>}
                    {uploadingFor === dt.id ? (
                      <input type="file" autoFocus disabled={busy}
                        onChange={e => e.target.files[0] && handleFile(dt.id, e.target.files[0])} />
                    ) : (
                      <button className="link" onClick={() => setUploadingFor(dt.id)}>
                        {existing ? 'Re-upload' : 'Upload'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
