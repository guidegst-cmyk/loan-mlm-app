import { supabase } from './supabase'

export async function fetchAgents() {
  const { data, error } = await supabase.from('agents').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchBanks() {
  const { data, error } = await supabase.from('banks').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchLoanTypes() {
  const { data, error } = await supabase.from('loan_types').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchDocumentTypes() {
  const { data, error } = await supabase.from('document_types').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchPayoutMatrix() {
  const { data, error } = await supabase.from('payout_matrix').select('*')
  if (error) throw error
  return data
}

export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*, banks(name), loan_types(name), generator:agents!leads_generator_agent_id_fkey(id,name), handler:agents!leads_case_handled_by_fkey(id,name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchCommissionLedger() {
  const { data, error } = await supabase
    .from('commission_ledger')
    .select('*, leads(customer_name), agents(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchDocuments(leadId) {
  const { data, error } = await supabase
    .from('loan_documents')
    .select('*, document_types(name)')
    .eq('lead_id', leadId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchChecklist(leadId) {
  const { data, error } = await supabase
    .from('lead_document_checklist')
    .select('*')
    .eq('lead_id', leadId)
  if (error) throw error
  return data
}

export async function createLead(payload) {
  const { data, error } = await supabase.from('leads').insert(payload).select()
  if (error) throw error
  return data
}

export async function updateLeadStatus(leadId, status) {
  const { data, error } = await supabase.from('leads').update({ status }).eq('id', leadId).select()
  if (error) throw error
  return data
}

export async function uploadDocument(lead_id, document_type_id, uploaded_by_agent_id, file) {
  const path = `${lead_id}/${document_type_id}/${Date.now()}_${file.name}`
  const { error: upErr } = await supabase.storage.from('loan-documents').upload(path, file)
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('loan_documents')
    .insert({ lead_id, document_type_id, file_path: path, uploaded_by_agent_id })
    .select()
  if (error) throw error
  return data
}

export async function getDocumentUrl(path) {
  const { data, error } = await supabase.storage.from('loan-documents').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

// Client-side subtree computation: given a root agent id, return the set of
// agent ids in that agent's downline (including themselves). Used to scope
// the Agent role's view of leads/commissions.
export function getSubtreeIds(rootId, allAgents) {
  const childrenOf = {}
  allAgents.forEach(a => {
    const p = a.parent_agent_id
    if (!childrenOf[p]) childrenOf[p] = []
    childrenOf[p].push(a.id)
  })
  const result = new Set([rootId])
  const queue = [rootId]
  while (queue.length) {
    const cur = queue.shift()
    const kids = childrenOf[cur] || []
    kids.forEach(k => {
      if (!result.has(k)) {
        result.add(k)
        queue.push(k)
      }
    })
  }
  return result
}

// ---------- Master data: banks, loan types, payout matrix ----------
export async function createBank(name) {
  const { data, error } = await supabase.from('banks').insert({ name }).select()
  if (error) throw error
  return data
}

export async function createLoanType(name) {
  const { data, error } = await supabase.from('loan_types').insert({ name }).select()
  if (error) throw error
  return data
}

export async function createPayoutRule(payload) {
  const { data, error } = await supabase.from('payout_matrix').insert(payload).select()
  if (error) throw error
  return data
}

export async function updatePayoutRule(id, payload) {
  const { data, error } = await supabase.from('payout_matrix').update(payload).eq('id', id).select()
  if (error) throw error
  return data
}

// ---------- Master data: agents ----------
export async function createAgent({ name, parent_agent_id, referral_code, status }) {
  const { data, error } = await supabase
    .from('agents')
    .insert({ name, parent_agent_id: parent_agent_id || null, referral_code, status })
    .select()
  if (error) throw error
  return data[0]
}

export async function updateAgent(id, payload) {
  const { data, error } = await supabase.from('agents').update(payload).eq('id', id).select()
  if (error) throw error
  return data
}

export async function createAgentLogin(agentId, username, password = 'Welcome@123') {
  const { error } = await supabase.rpc('create_agent_login', {
    p_agent_id: agentId, p_username: username, p_password: password,
  })
  if (error) throw error
}

// ---------- Agent documents ----------
export async function fetchAgentDocuments(agentId) {
  const { data, error } = await supabase
    .from('agent_documents')
    .select('*, document_types(name)')
    .eq('agent_id', agentId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data
}

export async function uploadAgentDocument(agent_id, document_type_id, uploaded_by_agent_id, file) {
  const path = `${agent_id}/${document_type_id}/${Date.now()}_${file.name}`
  const { error: upErr } = await supabase.storage.from('agent-documents').upload(path, file)
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('agent_documents')
    .insert({ agent_id, document_type_id, file_path: path, uploaded_by_agent_id })
    .select()
  if (error) throw error
  return data
}

export async function getAgentDocumentUrl(path) {
  const { data, error } = await supabase.storage.from('agent-documents').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function disburseLead(leadId, { disbursed_amount, disbursed_at }) {
  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'Disbursed', disbursed_amount, disbursed_at })
    .eq('id', leadId)
    .select()
  if (error) throw error
  return data
}

export async function raiseInvoice(ledgerEntryId) {
  const { data, error } = await supabase
    .from('commission_ledger')
    .update({ payout_status: 'due', invoiced_at: new Date().toISOString() })
    .eq('id', ledgerEntryId)
    .eq('payout_status', 'pending')
    .select()
  if (error) throw error
  return data
}

export async function markPaid(ledgerEntryId) {
  const { data, error } = await supabase
    .from('commission_ledger')
    .update({ payout_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', ledgerEntryId)
    .eq('payout_status', 'due')
    .select()
  if (error) throw error
  return data
}

// ---------- Agent self-onboarding ----------
export async function submitAgentApplication({ name, phone, email, referral_code_entered, desired_username, password }) {
  const { data, error } = await supabase.rpc('submit_agent_application', {
    p_name: name, p_phone: phone, p_email: email,
    p_referral_code_entered: referral_code_entered || null,
    p_desired_username: desired_username || null,
    p_password: password,
  })
  if (error) throw error
  return data
}

export async function fetchAgentApplications() {
  const { data, error } = await supabase
    .from('agent_applications_list')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}

export async function approveAgentApplication(applicationId, referralCode) {
  const { data, error } = await supabase.rpc('approve_agent_application', {
    p_application_id: applicationId, p_referral_code: referralCode,
  })
  if (error) throw error
  return data
}

export async function rejectAgentApplication(applicationId, reason) {
  const { error } = await supabase.rpc('reject_agent_application', {
    p_application_id: applicationId, p_reason: reason,
  })
  if (error) throw error
}

// ---------- Notifications (one-way admin broadcast) ----------
export async function createNotification({ title, message, target_type, target_agent_id }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ title, message, target_type, target_agent_id: target_agent_id || null })
    .select()
  if (error) throw error
  return data
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, agents(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
