import { useEffect, useMemo, useState } from 'react'
import { fetchAgents, fetchBanks, fetchLoanTypes, fetchLeads, fetchCommissionLedger, fetchPayoutMatrix, fetchDocumentTypes, fetchNotifications, fetchNotificationReads, markNotificationsRead, subscribeToNewNotifications, getSubtreeIds } from './lib/queries'
import { getSession, logout } from './lib/auth'
import Login from './components/Login'
import ApplyForm from './components/ApplyForm'
import AgentDashboard from './components/AgentDashboard'
import AgentTree from './components/AgentTree'
import LeadsTable from './components/LeadsTable'
import CommissionLedger from './components/CommissionLedger'
import LeadDetailModal from './components/LeadDetailModal'
import MasterData from './components/MasterData'
import Notifications from './components/Notifications'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [tab, setTab] = useState('dashboard')
  const params = new URLSearchParams(window.location.search)
  const [showApply, setShowApply] = useState(params.get('apply') === 'true')
  const prefillRef = params.get('ref') || ''

  const [agents, setAgents] = useState([])
  const [banks, setBanks] = useState([])
  const [loanTypes, setLoanTypes] = useState([])
  const [leads, setLeads] = useState([])
  const [ledger, setLedger] = useState([])
  const [payoutMatrix, setPayoutMatrix] = useState([])
  const [documentTypes, setDocumentTypes] = useState([])
  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [initialLeadStatus, setInitialLeadStatus] = useState(null)

  const role = session?.role
  const currentAgent = useMemo(
    () => agents.find(a => a.id === session?.agent_id),
    [agents, session]
  )

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [ag, bk, lt, ld, cl, pm, dt, nf] = await Promise.all([
        fetchAgents(), fetchBanks(), fetchLoanTypes(), fetchLeads(), fetchCommissionLedger(), fetchPayoutMatrix(), fetchDocumentTypes(), fetchNotifications(),
      ])
      setAgents(ag); setBanks(bk); setLoanTypes(lt); setLeads(ld); setLedger(cl); setPayoutMatrix(pm); setDocumentTypes(dt); setNotifications(nf)
      if (session?.role === 'agent' && session?.agent_id) {
        setReadIds(new Set(await fetchNotificationReads(session.agent_id)))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (session) loadAll() }, [session])

  // Live-update: when a new notification is inserted anywhere, push it into
  // local state immediately (no refresh needed) so the badge/list update live.
  useEffect(() => {
    if (!session) return
    const unsubscribe = subscribeToNewNotifications(newRow => {
      setNotifications(prev => [newRow, ...prev])
    })
    return unsubscribe
  }, [session])

  async function handleMarkRead(notificationIds) {
    if (!session?.agent_id) return
    setReadIds(prev => new Set([...prev, ...notificationIds]))
    try { await markNotificationsRead(session.agent_id, notificationIds) }
    catch { /* non-critical, badge will just recompute next load */ }
  }

  const scope = useMemo(() => {
    if (!session || role === 'admin' || !currentAgent) return null
    return getSubtreeIds(currentAgent.id, agents)
  }, [session, role, currentAgent, agents])

  const scopedLeads = useMemo(() => {
    if (!scope) return leads
    return leads.filter(l => scope.has(l.generator_agent_id))
  }, [leads, scope])

  const scopedLedger = useMemo(() => {
    if (!scope) return ledger
    const leadIds = new Set(scopedLeads.map(l => l.id))
    return ledger.filter(e => leadIds.has(e.lead_id))
  }, [ledger, scope, scopedLeads])

  const unreadNotifCount = useMemo(() => {
    if (role !== 'agent' || !currentAgent) return 0
    return notifications.filter(n => {
      if (readIds.has(n.id)) return false
      if (n.target_type === 'all') return true
      if (n.target_type === 'individual') return n.target_agent_id === currentAgent.id
      if (n.target_type === 'team') return getSubtreeIds(n.target_agent_id, agents).has(currentAgent.id)
      return false
    }).length
  }, [notifications, readIds, role, currentAgent, agents])

  const stats = useMemo(() => {
    const byStatus = {}
    scopedLeads.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1 })
    const pendingPayout = scopedLedger.filter(e => e.payout_status === 'pending').reduce((s, e) => s + Number(e.amount), 0)
    const dueEntries = scopedLedger.filter(e => e.payout_status === 'due')
    const duePayout = dueEntries.reduce((s, e) => s + Number(e.amount), 0)
    const paidPayout = scopedLedger.filter(e => e.payout_status === 'paid').reduce((s, e) => s + Number(e.amount), 0)
    return { byStatus, pendingPayout, duePayout, dueCount: dueEntries.length, dueEntries, paidPayout, totalLeads: scopedLeads.length }
  }, [scopedLeads, scopedLedger])

  if (!session) {
    if (showApply) {
      return <ApplyForm prefillRef={prefillRef} onDone={() => setShowApply(false)} />
    }
    return <Login onLogin={setSession} onApply={() => setShowApply(true)} />
  }

  if (loading) return <div className="center-msg">Loading…</div>
  if (error) return <div className="center-msg error">Error: {error}. Check your .env credentials and that the schema is deployed.</div>

  const tabs = role === 'admin'
    ? ['dashboard', 'agents', 'leads', 'commissions', 'notifications', 'masterdata']
    : ['dashboard', 'agents', 'leads', 'commissions', 'notifications']

  function handleLogout() {
    logout()
    setSession(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">LoanNexus.in</div>
        <div className="role-switcher" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>
            {role === 'admin' ? 'Admin' : currentAgent?.name} ({role})
          </span>
          <button className="btn" style={{ background: '#3a5a7c' }} onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(t => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t === 'dashboard' ? (role === 'agent' ? 'My Dashboard' : 'Dashboard') : t === 'masterdata' ? 'Master Data' : t[0].toUpperCase() + t.slice(1)}
            {t === 'notifications' && unreadNotifCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#c0392b', color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{unreadNotifCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'dashboard' && role === 'admin' && (
          <AdminDashboard
            leads={scopedLeads} ledger={scopedLedger} agents={agents} loanTypes={loanTypes} stats={stats}
            onGoToLeads={status => { setInitialLeadStatus(status); setTab('leads') }}
            onGoToCommissions={() => setTab('commissions')}
          />
        )}

        {tab === 'dashboard' && role === 'agent' && currentAgent && (
          <AgentDashboard currentAgent={currentAgent} leads={scopedLeads} ledger={scopedLedger} agents={agents} allAgents={agents} payoutMatrix={payoutMatrix} />
        )}

        {tab === 'agents' && <AgentTree agents={agents} role={role} currentAgent={currentAgent} />}

        {tab === 'leads' && (
          <LeadsTable
            leads={scopedLeads} agents={role === 'admin' ? agents : agents.filter(a => scope.has(a.id))}
            allAgents={agents} payoutMatrix={payoutMatrix}
            banks={banks} loanTypes={loanTypes} role={role} currentAgent={role === 'agent' ? currentAgent : null}
            onRefresh={loadAll} onSelectLead={l => setSelectedLeadId(l.id)}
            initialStatusFilter={initialLeadStatus}
          />
        )}

        {tab === 'commissions' && (
          <CommissionLedger
            entries={scopedLedger} leads={scopedLeads} role={role} payoutMatrix={payoutMatrix}
            agents={role === 'admin' ? agents : agents.filter(a => scope.has(a.id))}
            currentAgent={role === 'agent' ? currentAgent : null}
            onRefresh={loadAll}
          />
        )}
        {tab === 'notifications' && (
          <Notifications
            role={role} currentAgent={role === 'agent' ? currentAgent : null} agents={agents}
            items={notifications} readIds={readIds} onRefresh={loadAll} onMarkRead={handleMarkRead}
          />
        )}

        {tab === 'masterdata' && role === 'admin' && (
          <MasterData
            agents={agents} banks={banks} loanTypes={loanTypes}
            payoutMatrix={payoutMatrix} documentTypes={documentTypes}
            onRefresh={loadAll}
          />
        )}
      </main>

      {selectedLeadId && (() => {
        const freshLead = leads.find(l => l.id === selectedLeadId)
        return freshLead
          ? <LeadDetailModal lead={freshLead} currentAgent={currentAgent} banks={banks} onRefresh={loadAll} onClose={() => setSelectedLeadId(null)} />
          : null
      })()}
    </div>
  )
}
