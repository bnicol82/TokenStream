export type TaskTag = 'Tax' | 'Research' | 'Code' | 'General' | 'Triage' | 'Writing'

export interface Transaction {
  id: string
  ts: number // epoch ms
  provider: string
  model: string
  tag: string
  inputTokens: number
  outputTokens: number
  cost: number // optimized cost actually paid, in dollars
  baseCost: number // what it would have cost unoptimized
  optimized: boolean
  projectId?: string | null // which project this usage belongs to (null = Unassigned)
  workspaceId?: string | null
}

// A user-defined initiative used to track AI cost. Distinct from the task `tag`
// (work type) — a project can span many task types.
export interface Project {
  id: string
  name: string
  color: string
  keywords: string[] // used to auto-assign chats by scanning the prompt
  budget: number // monthly $ cap; 0 = no budget
  createdAt: number
  workspaceId?: string | null
}

export interface Budget {
  id: string
  name: string
  category: 'personal' | 'tax' | 'team'
  limit: number // dollars
  spent: number // dollars — legacy stored value; live usage derives from transactions
  tokenUsed: number
  tokenCap: number
  projectId?: string | null // scope: null/undefined = all usage, else a specific project
  workspaceId?: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  model?: string
  opt?: string
  cost?: number
  usage?: {
    tokens: number
    cost: number
    baseCost: number
    savedPct: number
    model: string
  }
  roiTag?: string
}

export interface Conversation {
  id: string
  title: string
  tag: string
  tagColor: string
  createdAt: number
  messages: ChatMessage[]
  projectId?: string | null
  modelName?: string | null // pinned model for this chat; null/undefined = Auto (cheapest)
  workspaceId?: string | null
}

export interface OptimizationSettings {
  routeIdx: number[] // index into MODELS per rule
  aggr: number // 0-100 compression aggressiveness
  engineOn: boolean
  caching: boolean
  trim: boolean
  applied: boolean
}

export interface AlertSettings {
  threshold: number // 50-100
  channels: { Email: boolean; Slack: boolean; 'In-App': boolean }
}

export interface CustomModel {
  id: string
  name: string
  provider: string
  priceIn: number // $ / 1M input tokens
  priceOut: number // $ / 1M output tokens
  speed: number // 1-5
  cost: number // 1-5 (5 = cheapest)
  quality: number // 1-5
  apiModel?: string // provider model id (e.g. OpenRouter "openai/gpt-4o")
}

// Client-visible metadata for a live provider integration. The API key itself
// is never exposed here — only a masked hint and sync status.
export interface ProviderConnection {
  id: string
  provider: string
  status: 'connected' | 'error'
  mode: 'live' | 'sandbox'
  keyHint: string // e.g. "••••a1b2" or "sandbox"
  lastSyncedAt: number | null // epoch ms
  lastError: string | null
}

// A tenancy unit. Every account has a Personal workspace; teams share one.
export interface Workspace {
  id: string
  name: string
  ownerId: string
  role: 'owner' | 'member' // the current user's role in this workspace
}

export interface WorkspaceMember {
  userId: string
  email: string
  role: 'owner' | 'member'
}

export interface AppData {
  transactions: Transaction[]
  budgets: Budget[]
  conversations: Conversation[]
  activeConversationId: string | null
  optimization: OptimizationSettings
  alerts: AlertSettings
  customModels: CustomModel[]
  providerConnections: ProviderConnection[]
  projects: Project[]
  activeProjectId: string | null
  workspaces: Workspace[]
  members: WorkspaceMember[]
  activeWorkspaceId: string | null
}
