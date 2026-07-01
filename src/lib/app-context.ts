// The app-wide context contract and hook. The provider lives in ./store —
// keeping the hook in its own file lets React Fast Refresh work on the provider.

import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type {
  AppData,
  Budget,
  OptimizationSettings,
  AlertSettings,
  Transaction,
  CustomModel,
  Project,
} from './types'

export interface Ctx {
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

export const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
