import type { AppData, Transaction, Budget, Conversation, Project, Workspace } from './types'
import { defaultFreeRouteIdx } from './models'
import { classifyProject } from './projects'

// Synthetic local workspace so the signed-out demo + offline mode behave like a
// single-workspace account (real workspaces come from the cloud when signed in).
export const LOCAL_WORKSPACE_ID = 'local'
const localWorkspace: Workspace = { id: LOCAL_WORKSPACE_ID, name: 'Personal', ownerId: 'local', role: 'owner' }

const id = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

// Build a base timestamp anchored to "Apr 18 2026" to match the design copy.
const day = (h: number, m: number) => new Date(2026, 3, 18, h, m).getTime()

// Generate a coherent ~30-day transaction history so dashboard aggregates are
// believable (monthly-scale spend, savings, and token volume) and update live
// as new chats are sent.
const PROVIDERS = [
  { provider: 'OpenAI', model: 'GPT-4o' },
  { provider: 'OpenAI', model: 'o3-mini' },
  { provider: 'Anthropic', model: 'Claude Sonnet' },
  { provider: 'Anthropic', model: 'Claude Haiku' },
  { provider: 'Grok', model: 'Grok-3' },
  { provider: 'Gemini', model: 'Gemini 2.5' },
  { provider: 'Together AI', model: 'Llama 3.3' },
  { provider: 'Mistral', model: 'Mistral Large' },
]
const TAGS = ['Tax', 'Research', 'Code', 'Triage', 'General', 'Writing']

// Demo projects for the signed-out experience. Keywords drive auto-assignment.
const seedProjects: Project[] = [
  { id: id(), name: 'Q1 Tax Filing', color: '#3ec98a', keywords: ['tax', 'deduct', 'filing', 'expense'], budget: 500, createdAt: day(8, 0) },
  { id: id(), name: 'Billing Revamp', color: '#9b6bff', keywords: ['billing', 'refactor', 'code', 'api', 'docs'], budget: 800, createdAt: day(8, 0) },
  { id: id(), name: 'Market Research', color: '#5b8dff', keywords: ['research', 'competitor', 'memo', 'investor'], budget: 0, createdAt: day(8, 0) },
]

// Target monthly headline figures (match the design narrative). Generated
// per-row costs are scaled to hit TARGET_SPEND exactly, so aggregates look
// right while individual rows keep realistic variation.
const TARGET_SPEND = 1247

function genTransactions(): Transaction[] {
  // Deterministic pseudo-random so the seed is stable across reloads.
  let s = 1337
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const now = day(9, 41)
  const txns: Transaction[] = []
  const count = 88
  for (let i = 0; i < count; i++) {
    const pm = PROVIDERS[Math.floor(rnd() * PROVIDERS.length)]
    const tag = TAGS[Math.floor(rnd() * TAGS.length)]
    const inputTokens = 3000 + Math.floor(rnd() * 10000)
    const outputTokens = 1500 + Math.floor(rnd() * 7000)
    const optimized = rnd() > 0.2
    const baseUnits = (inputTokens + outputTokens) / 1e6
    const savings = optimized ? 0.3 + rnd() * 0.25 : 0
    txns.push({
      id: id(),
      ts: now - Math.floor(rnd() * 30) * 86400000 - Math.floor(rnd() * 86400000),
      provider: pm.provider,
      model: pm.model,
      tag,
      inputTokens,
      outputTokens,
      cost: baseUnits * (1 - savings), // unscaled, scaled below
      baseCost: baseUnits,
      optimized,
      projectId: classifyProject(tag, seedProjects),
    })
  }

  // Scale costs so the optimized spend totals TARGET_SPEND.
  const rawSpend = txns.reduce((sum, t) => sum + t.cost, 0)
  const scale = TARGET_SPEND / rawSpend
  for (const t of txns) {
    t.cost = Math.round(t.cost * scale * 100) / 100
    t.baseCost = Math.round(t.baseCost * scale * 100) / 100
  }

  return txns.sort((a, b) => b.ts - a.ts)
}

const seedTxns = genTransactions()

const monthlySpend = seedTxns.reduce((sum, t) => sum + t.cost, 0)
const monthlyTokens = seedTxns.reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0)

const seedBudgets: Budget[] = [
  {
    id: id(),
    name: 'Personal Monthly',
    category: 'personal',
    limit: 2000,
    spent: Math.round(monthlySpend),
    tokenUsed: monthlyTokens,
    tokenCap: Math.ceil((monthlyTokens / 0.6) / 1000) * 1000,
  },
  { id: id(), name: 'Project: Tax Automation', category: 'tax', limit: 500, spent: 210, tokenUsed: 12100, tokenCap: 28000, projectId: seedProjects[0].id },
  { id: id(), name: 'Team Shared', category: 'team', limit: 1500, spent: 1290, tokenUsed: 61400, tokenCap: 90000, projectId: null },
]

const seedConversations: Conversation[] = [
  {
    id: id(),
    title: 'Q1 Tax Review',
    tag: 'Tax',
    tagColor: '#3ec98a',
    createdAt: day(9, 0),
    messages: [
      { id: id(), role: 'user', text: 'Can you pull the deductible vs non-deductible totals from the Q1 expense sheet?' },
      {
        id: id(),
        role: 'assistant',
        text: "Here's the Q1 breakdown: deductible $41,200 across software, travel, and contractor costs; non-deductible $3,850 (mostly meals over the 50% limit and two parking fines). Want me to itemize the non-deductible line?",
        model: 'Claude Haiku',
        opt: 'Compressed · routed',
        cost: 0.008,
      },
      { id: id(), role: 'user', text: 'Yes, and flag anything that looks unusual for a SaaS company this size.' },
      {
        id: id(),
        role: 'assistant',
        text: 'Itemized below. One outlier: a $1,900 "consulting" charge with no matching SOW — worth verifying before filing. Everything else tracks with prior quarters.',
        model: 'Llama 3.3',
        opt: 'Cached context',
        cost: 0.004,
        usage: { tokens: 2340, cost: 0.041, baseCost: 0.072, savedPct: 43, model: 'Llama 3.3 · smart routing' },
        roiTag: 'Tax Planning',
      },
    ],
  },
  { id: id(), title: 'Refactor billing module', tag: 'Code', tagColor: '#9b6bff', createdAt: day(8, 0), messages: [] },
  { id: id(), title: 'Competitor research memo', tag: 'Research', tagColor: '#5b8dff', createdAt: day(7, 0), messages: [] },
  { id: id(), title: 'Draft investor update', tag: 'Writing', tagColor: '#f0915a', createdAt: day(6, 0), messages: [] },
  { id: id(), title: 'Summarize support tickets', tag: 'Triage', tagColor: '#3ec98a', createdAt: day(5, 0), messages: [] },
  { id: id(), title: 'API docs cleanup', tag: 'Code', tagColor: '#9b6bff', createdAt: day(4, 0), messages: [] },
]

// Assign each demo conversation to a project based on its title keywords.
const seedConvosWithProjects = seedConversations.map((c) => ({
  ...c,
  projectId: classifyProject(`${c.title} ${c.tag}`, seedProjects),
}))

export function seedData(): AppData {
  return {
    transactions: seedTxns,
    budgets: seedBudgets,
    conversations: seedConvosWithProjects,
    activeConversationId: seedConversations[0].id,
    optimization: {
      routeIdx: [6, 1, 2, 4, 6], // Tax, Research, Code, General, Triage
      aggr: 60,
      engineOn: true,
      caching: true,
      trim: true,
      applied: false,
    },
    alerts: {
      threshold: 85,
      channels: { Email: true, Slack: true, 'In-App': true },
    },
    customModels: [],
    providerConnections: [],
    projects: seedProjects,
    activeProjectId: null,
    workspaces: [localWorkspace],
    members: [{ userId: 'local', email: 'you', role: 'owner' }],
    activeWorkspaceId: LOCAL_WORKSPACE_ID,
  }
}

// Fresh account starting state: no fake history, just sensible defaults so
// the dashboard isn't broken before the user logs any real usage.
export function emptyData(): AppData {
  return {
    transactions: [],
    budgets: [],
    conversations: [],
    activeConversationId: null,
    optimization: {
      routeIdx: defaultFreeRouteIdx(), // new users route to free models by default
      aggr: 60,
      engineOn: true,
      caching: true,
      trim: true,
      applied: false,
    },
    alerts: {
      threshold: 85,
      channels: { Email: true, Slack: true, 'In-App': true },
    },
    customModels: [],
    providerConnections: [],
    projects: [],
    activeProjectId: null,
    workspaces: [localWorkspace],
    members: [{ userId: 'local', email: 'you', role: 'owner' }],
    activeWorkspaceId: LOCAL_WORKSPACE_ID,
  }
}

export const newId = id
