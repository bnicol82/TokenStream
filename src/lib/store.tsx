import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type {
  AppData,
  Budget,
  ChatMessage,
  Conversation,
  OptimizationSettings,
  AlertSettings,
  Transaction,
  CustomModel,
  Project,
} from './types'
import { seedData, newId } from './seed'
import { classifyProject } from './projects'
import { estimateForModel, routedModel, combinedModels, MODELS } from './models'
import { isSupabaseConfigured, callChatFunction, callProvidersFunction, supabase } from './supabase'
import * as repo from './repo'

const STORAGE_KEY = 'tokenstream:data:v1'
// Active project is a transient working context — kept client-side only (not
// synced to the cloud), so it survives reloads for both local and cloud users.
const ACTIVE_PROJECT_KEY = 'tokenstream:activeProject'

function readActiveProject(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || null
  } catch {
    return null
  }
}

function writeActiveProject(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id)
    else localStorage.removeItem(ACTIVE_PROJECT_KEY)
  } catch {
    /* ignore */
  }
}

const ACTIVE_WS_KEY = 'tokenstream:activeWorkspace'
function readActiveWorkspace(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WS_KEY) || null
  } catch {
    return null
  }
}
function writeActiveWorkspace(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_WS_KEY, id)
    else localStorage.removeItem(ACTIVE_WS_KEY)
  } catch {
    /* ignore */
  }
}

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Merge over fresh defaults so payloads saved before a new field was added
    // (e.g. providerConnections) still load with that field present.
    if (raw) {
      const data = { ...seedData(), ...(JSON.parse(raw) as Partial<AppData>) } as AppData
      return { ...data, activeProjectId: readActiveProject() }
    }
  } catch {
    /* ignore */
  }
  return { ...seedData(), activeProjectId: readActiveProject() }
}

// Fire a Supabase write and log (but never throw) on failure.
function persist(p: { then: (cb: (r: { error: unknown }) => void) => void } | Promise<unknown>) {
  Promise.resolve(p as Promise<{ error?: unknown }>)
    .then((r) => {
      if (r && r.error) console.error('[TokenStream] Supabase write failed:', r.error)
    })
    .catch((e) => console.error('[TokenStream] Supabase write error:', e))
}

interface Ctx {
  data: AppData
  // auth
  session: Session | null
  authReady: boolean
  syncing: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>
  signOut: () => Promise<void>
  supabaseEnabled: boolean
  // chat
  newConversation: () => void
  selectConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  sendMessage: (conversationId: string, text: string, opts: { compress: boolean; route: boolean; cache: boolean }) => void
  setRoiTag: (conversationId: string, messageId: string, tag: string) => void
  // budgets
  addBudget: (b: Omit<Budget, 'id'>) => void
  updateBudget: (id: string, patch: Partial<Budget>) => void
  deleteBudget: (id: string) => void
  // optimization
  setOptimization: (patch: Partial<OptimizationSettings>) => void
  cycleRoute: (ruleIndex: number) => void
  // alerts
  setAlerts: (patch: Partial<AlertSettings>) => void
  // custom models
  addCustomModel: (m: Omit<CustomModel, 'id'>) => void
  deleteCustomModel: (id: string) => void
  // projects
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  setActiveProject: (id: string | null) => void
  setConversationProject: (conversationId: string, projectId: string | null) => void
  setConversationModel: (conversationId: string, modelName: string | null) => void
  // manual usage logging
  logTransaction: (t: Omit<Transaction, 'id'>) => void
  // live provider integrations (require cloud + deployed `providers` function)
  connectProvider: (provider: string, opts: { apiKey?: string; mode: 'live' | 'sandbox' }) => Promise<{ error: string | null }>
  syncProvider: (provider: string) => Promise<{ error: string | null; inserted: number; note: string | null }>
  disconnectProvider: (provider: string) => Promise<{ error: string | null }>
  // workspaces
  switchWorkspace: (id: string) => Promise<void>
  createWorkspace: (name: string) => Promise<{ error: string | null }>
  joinWorkspace: (code: string) => Promise<{ error: string | null }>
  createInviteCode: () => Promise<{ code: string | null; error: string | null }>
  removeWorkspaceMember: (userId: string) => Promise<void>
  leaveWorkspace: () => Promise<void>
  // misc
  resetAll: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [syncing, setSyncing] = useState(false)

  const userId = session?.user.id ?? null
  const cloud = Boolean(userId)

  // Subscribe to auth state
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load data when the session changes
  useEffect(() => {
    let cancelled = false
    if (cloud && userId) {
      setSyncing(true)
      ;(async () => {
        try {
          const email = session?.user.email ?? ''
          // Ensure a personal workspace exists (+ backfill legacy rows), then
          // pick the active workspace (stored preference if still valid).
          await repo.ensurePersonalWorkspace(userId, email)
          const workspaces = await repo.loadWorkspaces(userId)
          const stored = readActiveWorkspace()
          const activeWs = workspaces.find((w) => w.id === stored)?.id ?? workspaces[0]?.id
          if (!activeWs) throw new Error('No workspace available')
          let loaded = await repo.loadAll(userId, activeWs)
          if (!loaded) loaded = await repo.seedAccount(userId, activeWs)
          const members = await repo.loadMembers(activeWs)
          if (!cancelled)
            setData({ ...loaded, activeProjectId: readActiveProject(), workspaces, members, activeWorkspaceId: activeWs })
        } catch (e) {
          console.error('[TokenStream] cloud load failed — is the schema created?', e)
        } finally {
          if (!cancelled) setSyncing(false)
        }
      })()
    } else if (isSupabaseConfigured) {
      // signed out → revert to local demo data
      setData(loadLocal())
    }
    return () => {
      cancelled = true
    }
  }, [cloud, userId])

  // Persist to localStorage only when not signed in
  useEffect(() => {
    if (cloud) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* ignore quota */
    }
  }, [data, cloud])

  const api = useMemo<Ctx>(() => {
    const signIn: Ctx['signIn'] = async (email, password) => {
      if (!supabase) return { error: 'Supabase not configured' }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    }
    const signUp: Ctx['signUp'] = async (email, password) => {
      if (!supabase) return { error: 'Supabase not configured', needsConfirm: false }
      const { data, error } = await supabase.auth.signUp({ email, password })
      return { error: error?.message ?? null, needsConfirm: !error && !data.session }
    }
    const signOut = async () => {
      await supabase?.auth.signOut()
    }

    const newConversation = () => {
      const conv: Conversation = {
        id: newId(),
        title: 'New Chat',
        tag: 'General',
        tagColor: '#f0915a',
        createdAt: Date.now(),
        messages: [],
        projectId: data.activeProjectId, // inherit the active working project
        modelName: null, // Auto (cheapest) by default
        workspaceId: data.activeWorkspaceId,
      }
      setData((d) => ({ ...d, conversations: [conv, ...d.conversations], activeConversationId: conv.id }))
      if (cloud && userId) persist(repo.insertConversation(userId, conv))
    }

    const selectConversation = (id: string) => setData((d) => ({ ...d, activeConversationId: id }))

    const renameConversation: Ctx['renameConversation'] = (id, title) => {
      const t = title.trim()
      if (!t) return
      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) => (c.id === id ? { ...c, title: t } : c)),
      }))
      if (cloud) persist(repo.updateConversationTitle(id, t))
    }

    const deleteConversation: Ctx['deleteConversation'] = (id) => {
      setData((d) => {
        const conversations = d.conversations.filter((c) => c.id !== id)
        const activeConversationId =
          d.activeConversationId === id ? (conversations[0]?.id ?? null) : d.activeConversationId
        return { ...d, conversations, activeConversationId }
      })
      if (cloud) persist(repo.deleteConversationRow(id))
    }

    const patchMessageState = (conversationId: string, messageId: string, patch: Partial<ChatMessage>) =>
      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) =>
          c.id !== conversationId
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) },
        ),
      }))

    const sendMessage: Ctx['sendMessage'] = (conversationId, text, opts) => {
      const conv = data.conversations.find((c) => c.id === conversationId)
      if (!conv) return
      // Resolve the project: an explicit chat project wins, then the active
      // working project, then a keyword classification of the message text.
      const resolvedProjectId =
        conv.projectId ?? data.activeProjectId ?? classifyProject(text, data.projects)
      // Honor a per-conversation pinned model; otherwise auto-route to cheapest.
      const pinnedModel = conv.modelName
        ? combinedModels(data.customModels).find((m) => m.name === conv.modelName)
        : null
      const routed = pinnedModel ?? routedModel(opts.route && data.optimization.engineOn)
      const est = estimateForModel(text, { ...opts, aggr: data.optimization.aggr }, routed)

      const userMsg: ChatMessage = { id: newId(), role: 'user', text }
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: isSupabaseConfigured ? '…' : generateReply(text),
        model: routed.name,
        opt:
          [opts.compress && 'Compressed', opts.route && 'routed', opts.cache && 'cached']
            .filter(Boolean)
            .join(' · ') || 'Standard',
        cost: est.optCost,
        usage: {
          tokens: est.totalTokens,
          cost: est.optCost,
          baseCost: est.baseCost,
          savedPct: est.savingsPct,
          model: `${routed.name}${opts.route ? ' · smart routing' : ''}`,
        },
      }
      const isFirst = conv.messages.length === 0
      const newTitle = isFirst ? deriveTitle(text) : conv.title
      const txn: Transaction = {
        id: newId(),
        ts: Date.now(),
        provider: routed.provider,
        model: routed.name,
        tag: conv.tag,
        inputTokens: est.inputTokens + est.contextTokens,
        outputTokens: est.outputTokens,
        cost: est.optCost,
        baseCost: est.baseCost,
        optimized: opts.compress || opts.route || opts.cache,
        projectId: resolvedProjectId,
        workspaceId: data.activeWorkspaceId,
      }
      const projectChanged = (conv.projectId ?? null) !== (resolvedProjectId ?? null)

      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) =>
          c.id !== conversationId
            ? c
            : { ...c, title: newTitle, projectId: resolvedProjectId, messages: [...c.messages, userMsg, assistantMsg] },
        ),
        transactions: [txn, ...d.transactions],
      }))

      if (cloud && userId) {
        persist(repo.insertMessage(userId, conversationId, userMsg))
        persist(repo.insertMessage(userId, conversationId, assistantMsg))
        persist(repo.insertTransaction(userId, txn))
        if (isFirst) persist(repo.updateConversationTitle(conversationId, newTitle))
        if (projectChanged) persist(repo.updateConversationProject(conversationId, resolvedProjectId))
      }

      // Real reply via Edge Function when configured
      if (isSupabaseConfigured) {
        const history = [
          ...conv.messages.map((m) => ({ role: m.role, content: m.text })),
          { role: 'user' as const, content: text },
        ]
        callChatFunction(history, opts, { name: routed.name, provider: routed.provider, apiModel: routed.apiModel })
          .then((reply) => {
            patchMessageState(conversationId, assistantMsg.id, { text: reply.text, model: reply.model })
            if (cloud) persist(repo.updateMessageRow(assistantMsg.id, { text: reply.text, model: reply.model }))
          })
          .catch(() => {
            const fallback = generateReply(text)
            patchMessageState(conversationId, assistantMsg.id, { text: fallback })
            if (cloud) persist(repo.updateMessageRow(assistantMsg.id, { text: fallback }))
          })
      }
    }

    const setRoiTag: Ctx['setRoiTag'] = (conversationId, messageId, tag) => {
      patchMessageState(conversationId, messageId, { roiTag: tag })
      if (cloud) persist(repo.updateMessageRow(messageId, { roiTag: tag }))
    }

    const addBudget: Ctx['addBudget'] = (b) => {
      const budget: Budget = { ...b, id: newId(), workspaceId: data.activeWorkspaceId }
      setData((d) => ({ ...d, budgets: [...d.budgets, budget] }))
      if (cloud && userId) persist(repo.insertBudget(userId, budget))
    }

    const updateBudget: Ctx['updateBudget'] = (id, patch) => {
      let updated: Budget | undefined
      setData((d) => {
        const budgets = d.budgets.map((b) => {
          if (b.id !== id) return b
          updated = { ...b, ...patch }
          return updated
        })
        return { ...d, budgets }
      })
      if (cloud && userId && updated) persist(repo.updateBudgetRow(updated, userId))
    }

    const deleteBudget: Ctx['deleteBudget'] = (id) => {
      setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }))
      if (cloud) persist(repo.deleteBudgetRow(id))
    }

    const setOptimization: Ctx['setOptimization'] = (patch) => {
      const next = { ...data.optimization, ...patch }
      setData((d) => ({ ...d, optimization: { ...d.optimization, ...patch } }))
      if (cloud && userId) persist(repo.upsertOptimization(userId, next))
    }

    const cycleRoute: Ctx['cycleRoute'] = (ruleIndex) => {
      const catalogLen = MODELS.length + data.customModels.length
      const next = {
        ...data.optimization,
        routeIdx: data.optimization.routeIdx.map((v, i) => (i === ruleIndex ? (v + 1) % catalogLen : v)),
      }
      setData((d) => ({ ...d, optimization: next }))
      if (cloud && userId) persist(repo.upsertOptimization(userId, next))
    }

    const setAlerts: Ctx['setAlerts'] = (patch) => {
      const next = { ...data.alerts, ...patch }
      setData((d) => ({ ...d, alerts: { ...d.alerts, ...patch } }))
      if (cloud && userId) persist(repo.upsertAlerts(userId, next))
    }

    const addCustomModel: Ctx['addCustomModel'] = (m) => {
      const model: CustomModel = { ...m, id: newId() }
      setData((d) => ({ ...d, customModels: [...d.customModels, model] }))
      if (cloud && userId) persist(repo.insertCustomModel(userId, model))
    }

    const deleteCustomModel: Ctx['deleteCustomModel'] = (id) => {
      setData((d) => ({ ...d, customModels: d.customModels.filter((m) => m.id !== id) }))
      if (cloud) persist(repo.deleteCustomModelRow(id))
    }

    const logTransaction: Ctx['logTransaction'] = (t) => {
      const txn: Transaction = { ...t, id: newId(), workspaceId: data.activeWorkspaceId }
      setData((d) => ({ ...d, transactions: [txn, ...d.transactions] }))
      if (cloud && userId) persist(repo.insertTransaction(userId, txn))
    }

    const addProject: Ctx['addProject'] = (p) => {
      const project: Project = { ...p, id: newId(), createdAt: Date.now(), workspaceId: data.activeWorkspaceId }
      setData((d) => ({ ...d, projects: [...d.projects, project] }))
      if (cloud && userId) persist(repo.insertProject(userId, project))
      return project
    }

    const updateProject: Ctx['updateProject'] = (id, patch) => {
      let updated: Project | undefined
      setData((d) => {
        const projects = d.projects.map((p) => {
          if (p.id !== id) return p
          updated = { ...p, ...patch }
          return updated
        })
        return { ...d, projects }
      })
      if (cloud && userId && updated) persist(repo.updateProjectRow(updated, userId))
    }

    const deleteProject: Ctx['deleteProject'] = (id) => {
      // Drop the project and unassign any transactions/conversations that used it.
      setData((d) => ({
        ...d,
        projects: d.projects.filter((p) => p.id !== id),
        transactions: d.transactions.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
        conversations: d.conversations.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)),
        activeProjectId: d.activeProjectId === id ? null : d.activeProjectId,
      }))
      if (readActiveProject() === id) writeActiveProject(null)
      if (cloud) persist(repo.deleteProjectRow(id))
    }

    const setActiveProject: Ctx['setActiveProject'] = (id) => {
      writeActiveProject(id)
      setData((d) => ({ ...d, activeProjectId: id }))
    }

    const setConversationProject: Ctx['setConversationProject'] = (conversationId, projectId) => {
      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) => (c.id === conversationId ? { ...c, projectId } : c)),
      }))
      if (cloud) persist(repo.updateConversationProject(conversationId, projectId))
    }

    const setConversationModel: Ctx['setConversationModel'] = (conversationId, modelName) => {
      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) => (c.id === conversationId ? { ...c, modelName } : c)),
      }))
      if (cloud) persist(repo.updateConversationModel(conversationId, modelName))
    }

    // After the Edge Function writes connections/transactions server-side, pull
    // the authoritative state back so local data reflects what was stored.
    const refreshProviderState = async () => {
      const { connections, transactions } = await repo.loadProviderState()
      setData((d) => ({ ...d, providerConnections: connections, transactions }))
    }

    const connectProvider: Ctx['connectProvider'] = async (provider, opts) => {
      if (!cloud) return { error: 'Sign in to connect a provider.' }
      try {
        const res = await callProvidersFunction({ action: 'connect', provider, apiKey: opts.apiKey, mode: opts.mode })
        if (res.error) return { error: res.error }
        await refreshProviderState()
        return { error: null }
      } catch (e) {
        return { error: String(e) }
      }
    }

    const syncProvider: Ctx['syncProvider'] = async (provider) => {
      if (!cloud) return { error: 'Sign in to sync.', inserted: 0, note: null }
      try {
        const res = await callProvidersFunction({ action: 'sync', provider })
        if (res.error) return { error: res.error, inserted: 0, note: null }
        await refreshProviderState()
        return { error: null, inserted: res.inserted ?? 0, note: res.note ?? null }
      } catch (e) {
        return { error: String(e), inserted: 0, note: null }
      }
    }

    const disconnectProvider: Ctx['disconnectProvider'] = async (provider) => {
      if (!cloud) return { error: 'Sign in first.' }
      try {
        const res = await callProvidersFunction({ action: 'disconnect', provider })
        if (res.error) return { error: res.error }
        await refreshProviderState()
        return { error: null }
      } catch (e) {
        return { error: String(e) }
      }
    }

    // ---- workspaces -------------------------------------------------------
    // Load all data for a given workspace and swap it into state.
    const loadWorkspaceData = async (wsId: string) => {
      if (!userId) return
      writeActiveWorkspace(wsId)
      setSyncing(true)
      try {
        let loaded = await repo.loadAll(userId, wsId)
        if (!loaded) loaded = await repo.seedAccount(userId, wsId)
        const [workspaces, members] = await Promise.all([repo.loadWorkspaces(userId), repo.loadMembers(wsId)])
        setData((d) => ({
          ...loaded!,
          activeProjectId: d.activeProjectId,
          workspaces,
          members,
          activeWorkspaceId: wsId,
        }))
      } catch (e) {
        console.error('[TokenStream] workspace load failed', e)
      } finally {
        setSyncing(false)
      }
    }

    const switchWorkspace: Ctx['switchWorkspace'] = async (id) => {
      if (!cloud || id === data.activeWorkspaceId) {
        writeActiveWorkspace(id)
        setData((d) => ({ ...d, activeWorkspaceId: id }))
        return
      }
      await loadWorkspaceData(id)
    }

    const createWorkspace: Ctx['createWorkspace'] = async (name) => {
      if (!cloud || !userId) return { error: 'Sign in to create a workspace.' }
      try {
        const ws = await repo.createWorkspace(userId, session?.user.email ?? '', name.trim() || 'New workspace')
        await loadWorkspaceData(ws.id)
        return { error: null }
      } catch (e) {
        return { error: String(e) }
      }
    }

    const joinWorkspace: Ctx['joinWorkspace'] = async (code) => {
      if (!cloud) return { error: 'Sign in to join a workspace.' }
      try {
        const wsId = await repo.acceptInvite(code)
        await loadWorkspaceData(wsId)
        return { error: null }
      } catch (e) {
        return { error: String(e) }
      }
    }

    const createInviteCode: Ctx['createInviteCode'] = async () => {
      if (!cloud || !userId || !data.activeWorkspaceId) return { code: null, error: 'Sign in first.' }
      try {
        const code = await repo.createInvite(data.activeWorkspaceId, userId)
        return { code, error: null }
      } catch (e) {
        return { code: null, error: String(e) }
      }
    }

    const removeWorkspaceMember: Ctx['removeWorkspaceMember'] = async (memberId) => {
      if (!cloud || !data.activeWorkspaceId) return
      await repo.removeMember(data.activeWorkspaceId, memberId)
      setData((d) => ({ ...d, members: d.members.filter((m) => m.userId !== memberId) }))
    }

    const leaveWorkspace: Ctx['leaveWorkspace'] = async () => {
      if (!cloud || !userId || !data.activeWorkspaceId) return
      await repo.removeMember(data.activeWorkspaceId, userId)
      const remaining = await repo.loadWorkspaces(userId)
      const next = remaining[0]?.id
      if (next) await loadWorkspaceData(next)
    }

    const resetAll = () => setData(seedData())

    return {
      data,
      session,
      authReady,
      syncing,
      signIn,
      signUp,
      signOut,
      supabaseEnabled: isSupabaseConfigured,
      newConversation,
      selectConversation,
      renameConversation,
      deleteConversation,
      sendMessage,
      setRoiTag,
      addBudget,
      updateBudget,
      deleteBudget,
      setOptimization,
      cycleRoute,
      setAlerts,
      addCustomModel,
      deleteCustomModel,
      addProject,
      updateProject,
      deleteProject,
      setActiveProject,
      setConversationProject,
      setConversationModel,
      logTransaction,
      connectProvider,
      syncProvider,
      disconnectProvider,
      switchWorkspace,
      createWorkspace,
      joinWorkspace,
      createInviteCode,
      removeWorkspaceMember,
      leaveWorkspace,
      resetAll,
    }
  }, [data, session, authReady, syncing, cloud, userId])

  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// --- helpers ---------------------------------------------------------------

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= 38 ? t : t.slice(0, 38) + '…'
}

// Lightweight simulated assistant. Used when no backend is configured, or as a
// fallback if the Edge Function call fails.
function generateReply(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('tax') || t.includes('deduct') || t.includes('expense'))
    return 'Reviewed the figures. Most line items are deductible; I flagged two that need a receipt before filing. Want a categorized summary you can hand to your accountant?'
  if (t.includes('code') || t.includes('refactor') || t.includes('bug'))
    return "Here's a cleaner approach: extract the shared logic into a helper, add a guard for the empty case, and keep the public API unchanged. I can draft the diff if helpful."
  if (t.includes('research') || t.includes('competitor') || t.includes('memo'))
    return 'Pulled the key points and grouped them by theme. The clearest signal is pricing pressure in the mid-market — I can expand any section into a full memo.'
  return "Got it. Here's a concise, optimized response — routed to the cheapest model that clears the quality bar for this request, with the prompt compressed to cut token cost."
}
