// Supabase persistence layer. Maps between the app's camelCase types and the
// snake_case Postgres columns defined in supabase/schema.sql. All functions
// assume an authenticated session (RLS scopes rows to the user).

import { supabase } from './supabase'
import type {
  AppData,
  Budget,
  ChatMessage,
  Conversation,
  Transaction,
  OptimizationSettings,
  AlertSettings,
  CustomModel,
  ProviderConnection,
  Project,
  Workspace,
  WorkspaceMember,
} from './types'
import { emptyData } from './seed'

function db() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ---- mappers --------------------------------------------------------------

const txnToRow = (t: Transaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  ts: new Date(t.ts).toISOString(),
  provider: t.provider,
  model: t.model,
  tag: t.tag,
  input_tokens: t.inputTokens,
  output_tokens: t.outputTokens,
  cost: t.cost,
  base_cost: t.baseCost,
  optimized: t.optimized,
  project_id: t.projectId ?? null,
  workspace_id: t.workspaceId ?? null,
})
const rowToTxn = (r: any): Transaction => ({
  id: r.id,
  ts: new Date(r.ts).getTime(),
  provider: r.provider,
  model: r.model,
  tag: r.tag,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  cost: Number(r.cost),
  baseCost: Number(r.base_cost),
  optimized: r.optimized,
  projectId: r.project_id ?? null,
  workspaceId: r.workspace_id ?? null,
})

const budgetToRow = (b: Budget, userId: string) => ({
  id: b.id,
  user_id: userId,
  name: b.name,
  category: b.category,
  budget_limit: b.limit,
  spent: b.spent,
  token_used: b.tokenUsed,
  token_cap: b.tokenCap,
  project_id: b.projectId ?? null,
  workspace_id: b.workspaceId ?? null,
})
const rowToBudget = (r: any): Budget => ({
  id: r.id,
  name: r.name,
  category: r.category,
  limit: Number(r.budget_limit),
  spent: Number(r.spent),
  tokenUsed: Number(r.token_used),
  tokenCap: Number(r.token_cap),
  projectId: r.project_id ?? null,
  workspaceId: r.workspace_id ?? null,
})

const convToRow = (c: Conversation, userId: string) => ({
  id: c.id,
  user_id: userId,
  title: c.title,
  tag: c.tag,
  tag_color: c.tagColor,
  created_at: new Date(c.createdAt).toISOString(),
  project_id: c.projectId ?? null,
  model_name: c.modelName ?? null,
  workspace_id: c.workspaceId ?? null,
})
const msgToRow = (m: ChatMessage, conversationId: string, userId: string) => ({
  id: m.id,
  conversation_id: conversationId,
  user_id: userId,
  role: m.role,
  text: m.text,
  model: m.model ?? null,
  opt: m.opt ?? null,
  cost: m.cost ?? null,
  usage: m.usage ?? null,
  roi_tag: m.roiTag ?? null,
})
const rowToMsg = (r: any): ChatMessage => ({
  id: r.id,
  role: r.role,
  text: r.text,
  model: r.model ?? undefined,
  opt: r.opt ?? undefined,
  cost: r.cost != null ? Number(r.cost) : undefined,
  usage: r.usage ?? undefined,
  roiTag: r.roi_tag ?? undefined,
})

const modelToRow = (m: CustomModel, userId: string) => ({
  id: m.id,
  user_id: userId,
  name: m.name,
  provider: m.provider,
  price_in: m.priceIn,
  price_out: m.priceOut,
  speed: m.speed,
  cost: m.cost,
  quality: m.quality,
  api_model: m.apiModel ?? null,
})
const rowToModel = (r: any): CustomModel => ({
  id: r.id,
  name: r.name,
  provider: r.provider,
  priceIn: Number(r.price_in),
  priceOut: Number(r.price_out),
  speed: r.speed,
  cost: r.cost,
  quality: r.quality,
  apiModel: r.api_model ?? undefined,
})

const rowToConnection = (r: any): ProviderConnection => ({
  id: r.id,
  provider: r.provider,
  status: r.status,
  mode: r.mode,
  keyHint: r.key_hint ?? '',
  lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).getTime() : null,
  lastError: r.last_error ?? null,
})

const projectToRow = (p: Project, userId: string) => ({
  id: p.id,
  user_id: userId,
  name: p.name,
  color: p.color,
  keywords: p.keywords,
  budget: p.budget,
  created_at: new Date(p.createdAt).toISOString(),
  workspace_id: p.workspaceId ?? null,
})
const rowToProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  color: r.color,
  keywords: r.keywords ?? [],
  budget: Number(r.budget),
  createdAt: new Date(r.created_at).getTime(),
  workspaceId: r.workspace_id ?? null,
})

// ---- load -----------------------------------------------------------------

export async function loadAll(userId: string, workspaceId: string): Promise<AppData | null> {
  const c = db()
  // Shared data is scoped to the active workspace; conversations are private
  // (RLS limits to the user) but also filtered to the active workspace.
  const [txns, budgets, convs, msgs, opt, alerts, customModels, connections, projects] = await Promise.all([
    c.from('transactions').select('*').eq('workspace_id', workspaceId).order('ts', { ascending: false }),
    c.from('budgets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
    c.from('conversations').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    c.from('messages').select('*').order('created_at', { ascending: true }),
    c.from('optimization_settings').select('*').eq('user_id', userId).maybeSingle(),
    c.from('alert_settings').select('*').eq('user_id', userId).maybeSingle(),
    c.from('custom_models').select('*').order('created_at', { ascending: true }),
    c.from('provider_connections').select('*').order('created_at', { ascending: true }),
    c.from('projects').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
  ])
  for (const r of [txns, budgets, convs, msgs, opt, alerts, customModels, connections, projects]) {
    if (r.error) throw r.error
  }

  // Never initialized (no settings rows yet) → caller should seed defaults.
  if (!opt.data && !alerts.data) return null

  const conversations: Conversation[] = (convs.data ?? []).map((cv: any) => ({
    id: cv.id,
    title: cv.title,
    tag: cv.tag,
    tagColor: cv.tag_color,
    createdAt: new Date(cv.created_at).getTime(),
    projectId: cv.project_id ?? null,
    modelName: cv.model_name ?? null,
    messages: (msgs.data ?? []).filter((m: any) => m.conversation_id === cv.id).map(rowToMsg),
  }))

  const defaults = emptyData()

  const optimization: OptimizationSettings = opt.data
    ? {
        routeIdx: opt.data.route_idx,
        aggr: opt.data.aggr,
        engineOn: opt.data.engine_on,
        caching: opt.data.caching,
        trim: opt.data.trim,
        applied: opt.data.applied,
      }
    : defaults.optimization

  const alertSettings: AlertSettings = alerts.data
    ? { threshold: alerts.data.threshold, channels: alerts.data.channels }
    : defaults.alerts

  return {
    transactions: (txns.data ?? []).map(rowToTxn),
    budgets: (budgets.data ?? []).map(rowToBudget),
    conversations,
    activeConversationId: conversations[0]?.id ?? null,
    optimization,
    alerts: alertSettings,
    customModels: (customModels.data ?? []).map(rowToModel),
    providerConnections: (connections.data ?? []).map(rowToConnection),
    projects: (projects.data ?? []).map(rowToProject),
    activeProjectId: null,
    workspaces: [], // filled by the store from loadWorkspaces
    members: [],
    activeWorkspaceId: workspaceId,
  }
}

// Re-fetch just the live-provider state (connections + transactions) after a
// connect/sync/disconnect, which the Edge Function wrote server-side.
export async function loadProviderState(): Promise<{
  connections: ProviderConnection[]
  transactions: Transaction[]
}> {
  const c = db()
  const [connections, txns] = await Promise.all([
    c.from('provider_connections').select('*').order('created_at', { ascending: true }),
    c.from('transactions').select('*').order('ts', { ascending: false }),
  ])
  if (connections.error) throw connections.error
  if (txns.error) throw txns.error
  return {
    connections: (connections.data ?? []).map(rowToConnection),
    transactions: (txns.data ?? []).map(rowToTxn),
  }
}

// First-login: initialize the account with empty real data plus default
// settings rows (no demo dataset — real usage starts from zero).
export async function seedAccount(userId: string, workspaceId: string): Promise<AppData> {
  const data = emptyData()
  await upsertOptimization(userId, data.optimization)
  await upsertAlerts(userId, data.alerts)
  return { ...data, activeWorkspaceId: workspaceId }
}

// ---- workspaces -----------------------------------------------------------

const rowToWorkspace = (r: any, role: 'owner' | 'member'): Workspace => ({
  id: r.id,
  name: r.name,
  ownerId: r.owner_id,
  role,
})

// Load the workspaces this user belongs to (with their role in each).
export async function loadWorkspaces(userId: string): Promise<Workspace[]> {
  const c = db()
  const { data, error } = await c
    .from('workspace_members')
    .select('role, workspaces ( id, name, owner_id )')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? [])
    .filter((m: any) => m.workspaces)
    .map((m: any) => rowToWorkspace(m.workspaces, m.role))
}

export async function loadMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await db()
    .from('workspace_members')
    .select('user_id, email, role')
    .eq('workspace_id', workspaceId)
  if (error) throw error
  return (data ?? []).map((m: any) => ({ userId: m.user_id, email: m.email ?? '—', role: m.role }))
}

// Ensure the user has at least a Personal workspace; backfill legacy rows.
// Returns the id of the personal (owned) workspace.
export async function ensurePersonalWorkspace(userId: string, email: string): Promise<string> {
  const c = db()
  const existing = await loadWorkspaces(userId)
  const owned = existing.find((w) => w.ownerId === userId)
  if (owned) return owned.id
  if (existing.length > 0) return existing[0].id // member-only; no personal needed

  const { data: ws, error } = await c
    .from('workspaces')
    .insert({ owner_id: userId, name: 'Personal' })
    .select()
    .single()
  if (error) throw error
  const wsId = ws.id as string
  await c.from('workspace_members').insert({ workspace_id: wsId, user_id: userId, email, role: 'owner' })
  // Backfill: claim the user's pre-workspace rows into their personal workspace.
  for (const t of ['transactions', 'projects', 'budgets', 'conversations']) {
    await c.from(t).update({ workspace_id: wsId }).eq('user_id', userId).is('workspace_id', null)
  }
  return wsId
}

export async function createWorkspace(userId: string, email: string, name: string): Promise<Workspace> {
  const c = db()
  const { data: ws, error } = await c.from('workspaces').insert({ owner_id: userId, name }).select().single()
  if (error) throw error
  await c.from('workspace_members').insert({ workspace_id: ws.id, user_id: userId, email, role: 'owner' })
  return rowToWorkspace(ws, 'owner')
}

export const renameWorkspaceRow = (id: string, name: string) =>
  db().from('workspaces').update({ name }).eq('id', id)

// Create an invite code (short, shareable). Owner-only via RLS.
export async function createInvite(workspaceId: string, userId: string): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
  const { error } = await db()
    .from('workspace_invites')
    .insert({ code, workspace_id: workspaceId, created_by: userId })
  if (error) throw error
  return code
}

// Join a workspace via invite code → returns the workspace id.
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await db().rpc('accept_invite', { invite_code: code.trim() })
  if (error) throw error
  return data as string
}

export const removeMember = (workspaceId: string, userId: string) =>
  db().from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId)

export const insertCustomModel = (userId: string, m: CustomModel) =>
  db().from('custom_models').insert(modelToRow(m, userId))

export const deleteCustomModelRow = (id: string) => db().from('custom_models').delete().eq('id', id)

export const insertProject = (userId: string, p: Project) =>
  db().from('projects').insert(projectToRow(p, userId))

export const updateProjectRow = (p: Project, userId: string) =>
  db().from('projects').update(projectToRow(p, userId)).eq('id', p.id)

// Delete a project and unassign it from the user's transactions/conversations
// (no DB-level FK, so the app clears the references).
export const deleteProjectRow = async (id: string) => {
  const c = db()
  await c.from('transactions').update({ project_id: null }).eq('project_id', id)
  await c.from('conversations').update({ project_id: null }).eq('project_id', id)
  return c.from('projects').delete().eq('id', id)
}

export const updateConversationProject = (id: string, projectId: string | null) =>
  db().from('conversations').update({ project_id: projectId }).eq('id', id)

export const updateConversationModel = (id: string, modelName: string | null) =>
  db().from('conversations').update({ model_name: modelName }).eq('id', id)

// ---- writes (fire-and-forget from the store) ------------------------------

export const insertTransaction = (userId: string, t: Transaction) =>
  db().from('transactions').insert(txnToRow(t, userId))

export const insertBudget = (userId: string, b: Budget) =>
  db().from('budgets').insert(budgetToRow(b, userId))

export const updateBudgetRow = (b: Budget, userId: string) =>
  db().from('budgets').update(budgetToRow(b, userId)).eq('id', b.id)

export const deleteBudgetRow = (id: string) => db().from('budgets').delete().eq('id', id)

export const insertConversation = (userId: string, c: Conversation) =>
  db().from('conversations').insert(convToRow(c, userId))

export const updateConversationTitle = (id: string, title: string) =>
  db().from('conversations').update({ title }).eq('id', id)

export const deleteConversationRow = (id: string) => db().from('conversations').delete().eq('id', id)

export const insertMessage = (userId: string, conversationId: string, m: ChatMessage) =>
  db().from('messages').insert(msgToRow(m, conversationId, userId))

export const updateMessageRow = (id: string, patch: Partial<ChatMessage>) => {
  const row: Record<string, unknown> = {}
  if (patch.text !== undefined) row.text = patch.text
  if (patch.model !== undefined) row.model = patch.model
  if (patch.roiTag !== undefined) row.roi_tag = patch.roiTag
  return db().from('messages').update(row).eq('id', id)
}

export const upsertOptimization = (userId: string, o: OptimizationSettings) =>
  db()
    .from('optimization_settings')
    .upsert({
      user_id: userId,
      route_idx: o.routeIdx,
      aggr: o.aggr,
      engine_on: o.engineOn,
      caching: o.caching,
      trim: o.trim,
      applied: o.applied,
      updated_at: new Date().toISOString(),
    })

export const upsertAlerts = (userId: string, a: AlertSettings) =>
  db()
    .from('alert_settings')
    .upsert({ user_id: userId, threshold: a.threshold, channels: a.channels, updated_at: new Date().toISOString() })
