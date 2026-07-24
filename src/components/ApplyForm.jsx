import { useState } from 'react'
import { submitAgentApplication, uploadApplicationDocument } from '../lib/queries'

const COMPULSORY_DOCS = ['PAN', 'Aadhar', 'Photo', 'Cancelled Cheque']
const OPTIONAL_DOCS = ['Optional Document 1', 'Optional Document 2']

export default function ApplyForm({ prefillRef, onDone }) {
  const [step, setStep] = useState('details') // 'details' | 'documents' | 'done'
  const [applicationId, setApplicationId] = useState(null)
  const [applicantName, setApplicantName] = useState('')

  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    referral_code_entered: prefillRef || '',
    desired_username: '', password: '', confirmPassword: '',
    father_name: '', present_address: '', permanent_address: '', sameAsPresent: false,
    pan_number: '', aadhar_number: '', qualification: '',
    bank_name: '', account_number: '', ifsc_code: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function setField(key, value) {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'sameAsPresent' && value) next.permanent_address = next.present_address
      if (key === 'present_address' && f.sameAsPresent) next.permanent_address = value
      return next
    })
  }

  async function submitDetails(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password should be at least 6 characters'); return }
    setBusy(true)
    try {
      const id = await submitAgentApplication({ ...form })
      setApplicationId(id)
      setApplicantName(form.name)
      setStep('documents')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h2 style={{ color: '#1A3A5C' }}>Application submitted</h2>
          <p style={{ color: '#555', fontSize: 14 }}>
            Thanks, {applicantName}! Your application and documents are pending admin review. You'll be able
            to log in with the username and password you set once it's approved.
          </p>
          <button className="btn" onClick={onDone}>Back to login</button>
        </div>
      </div>
    )
  }

  if (step === 'documents') {
    return (
      <DocumentsStep
        applicationId={applicationId}
        applicantName={applicantName}
        onFinish={() => setStep('done')}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 20 }}>
      <form onSubmit={submitDetails} className="card" style={{ width: '100%', maxWidth: 460 }}>
        <h2 style={{ marginTop: 0, color: '#1A3A5C' }}>Become a Partner</h2>
        <p style={{ fontSize: 13, color: '#777', marginTop: -8 }}>Step 1 of 2 — your details. Documents come next.</p>

        <SectionLabel>Basic details</SectionLabel>
        <FieldLabel>Full name</FieldLabel>
        <FieldInput required value={form.name} onChange={v => setField('name', v)} />
        <FieldLabel>Father's name</FieldLabel>
        <FieldInput required value={form.father_name} onChange={v => setField('father_name', v)} />
        <FieldLabel>Phone</FieldLabel>
        <FieldInput required value={form.phone} onChange={v => setField('phone', v)} />
        <FieldLabel>Email</FieldLabel>
        <FieldInput required type="email" value={form.email} onChange={v => setField('email', v)} />
        <FieldLabel>Qualification</FieldLabel>
        <FieldInput required value={form.qualification} onChange={v => setField('qualification', v)} placeholder="e.g. B.Com" />

        <SectionLabel>Address</SectionLabel>
        <FieldLabel>Present address</FieldLabel>
        <FieldTextarea required value={form.present_address} onChange={v => setField('present_address', v)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', margin: '8px 0' }}>
          <input type="checkbox" checked={form.sameAsPresent} onChange={e => setField('sameAsPresent', e.target.checked)} />
          Permanent address same as present address
        </label>
        {!form.sameAsPresent && (
          <>
            <FieldLabel>Permanent address</FieldLabel>
            <FieldTextarea required value={form.permanent_address} onChange={v => setField('permanent_address', v)} />
          </>
        )}

        <SectionLabel>KYC</SectionLabel>
        <FieldLabel>PAN number</FieldLabel>
        <FieldInput required value={form.pan_number} onChange={v => setField('pan_number', v.toUpperCase())} placeholder="ABCDE1234F" />
        <FieldLabel>Aadhar number</FieldLabel>
        <FieldInput required value={form.aadhar_number} onChange={v => setField('aadhar_number', v)} placeholder="12-digit number" />

        <SectionLabel>Bank details (for commission payouts)</SectionLabel>
        <FieldLabel>Bank name</FieldLabel>
        <FieldInput required value={form.bank_name} onChange={v => setField('bank_name', v)} />
        <FieldLabel>Account number</FieldLabel>
        <FieldInput required value={form.account_number} onChange={v => setField('account_number', v)} />
        <FieldLabel>IFSC code</FieldLabel>
        <FieldInput required value={form.ifsc_code} onChange={v => setField('ifsc_code', v.toUpperCase())} />

        <SectionLabel>Login</SectionLabel>
        {prefillRef ? (
          <>
            <FieldLabel>Referred by</FieldLabel>
            <div style={{ width: '100%', padding: 9, border: '1px solid #ddd', borderRadius: 6, background: '#f3f4f6', color: '#333', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔒 {prefillRef}
            </div>
          </>
        ) : (
          <>
            <FieldLabel>Referral code</FieldLabel>
            <FieldInput value={form.referral_code_entered} onChange={v => setField('referral_code_entered', v)} placeholder="e.g. rk-006" />
          </>
        )}
        <FieldLabel>Choose a username (optional — defaults to your referral code once assigned)</FieldLabel>
        <FieldInput value={form.desired_username} onChange={v => setField('desired_username', v)} />
        <FieldLabel>Set a password</FieldLabel>
        <FieldInput type="password" required value={form.password} onChange={v => setField('password', v)} />
        <FieldLabel>Confirm password</FieldLabel>
        <FieldInput type="password" required value={form.confirmPassword} onChange={v => setField('confirmPassword', v)} />

        {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 14 }}>
          {busy ? 'Saving…' : 'Continue to documents →'}
        </button>
        <button type="button" className="link" onClick={onDone} style={{ display: 'block', margin: '10px auto 0' }}>
          Already have a login? Sign in
        </button>
      </form>
    </div>
  )
}

function DocumentsStep({ applicationId, applicantName, onFinish }) {
  const [uploaded, setUploaded] = useState({}) // label -> file name
  const [uploadingFor, setUploadingFor] = useState(null)
  const [error, setError] = useState('')

  const allCompulsoryDone = COMPULSORY_DOCS.every(label => uploaded[label])

  async function handleFile(label, file) {
    setUploadingFor(label)
    setError('')
    try {
      await uploadApplicationDocument(applicationId, label, file)
      setUploaded(u => ({ ...u, [label]: file.name }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 460 }}>
        <h2 style={{ marginTop: 0, color: '#1A3A5C' }}>Upload documents</h2>
        <p style={{ fontSize: 13, color: '#777', marginTop: -8 }}>Step 2 of 2 — {applicantName}, please upload the following.</p>

        <SectionLabel>Compulsory</SectionLabel>
        {COMPULSORY_DOCS.map(label => (
          <DocRow key={label} label={label} required
            done={uploaded[label]} busy={uploadingFor === label}
            onFile={file => handleFile(label, file)} />
        ))}

        <SectionLabel>Optional</SectionLabel>
        {OPTIONAL_DOCS.map(label => (
          <DocRow key={label} label={label}
            done={uploaded[label]} busy={uploadingFor === label}
            onFile={file => handleFile(label, file)} />
        ))}

        {error && <p style={{ color: '#a32d2d', fontSize: 13 }}>{error}</p>}

        <button className="btn" disabled={!allCompulsoryDone} onClick={onFinish} style={{ width: '100%', marginTop: 16 }}>
          {allCompulsoryDone ? 'Finish application' : 'Upload all compulsory documents to continue'}
        </button>
      </div>
    </div>
  )
}

function DocRow({ label, required, done, busy, onFile }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label} {required && <span style={{ color: '#a32d2d' }}>*</span>}</div>
        {done && <div style={{ fontSize: 12, color: '#3CA06B' }}>✓ Uploaded</div>}
      </div>
      <div>
        {busy ? (
          <span style={{ fontSize: 12, color: '#888' }}>Uploading…</span>
        ) : (
          <label className="link" style={{ cursor: 'pointer' }}>
            {done ? 'Re-upload' : 'Upload'}
            <input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#1A3A5C', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 18, marginBottom: 8, borderTop: '1px solid #eee', paddingTop: 14 }}>{children}</div>
}
function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 }}>{children}</label>
}
function FieldInput({ value, onChange, type = 'text', required, placeholder }) {
  return (
    <input
      type={type} required={required} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: 9, border: '1px solid #ccc', borderRadius: 6 }}
    />
  )
}
function FieldTextarea({ value, onChange, required }) {
  return (
    <textarea
      required={required} value={value} rows={2}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: 9, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }}
    />
  )
}
