import { useState } from 'react'
import { useApp } from '../lib/app-context'

export default function Account() {
  const { supabaseEnabled, session, syncing, signIn, signUp, signOut } = useApp()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  if (!supabaseEnabled) return null

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await signIn(email, password)
      if (error) setMsg({ kind: 'error', text: error })
      else setOpen(false)
    } else {
      const { error, needsConfirm } = await signUp(email, password)
      if (error) setMsg({ kind: 'error', text: error })
      else if (needsConfirm) setMsg({ kind: 'info', text: 'Check your email to confirm, then sign in.' })
      else setOpen(false)
    }
    setBusy(false)
  }

  if (session) {
    return (
      <div className="ml-auto flex items-center gap-3">
        {syncing && <span className="text-textDim text-xs">Syncing…</span>}
        <span className="text-textMuted text-[13px] font-medium max-w-[180px] truncate max-md:hidden">{session.user.email}</span>
        <button
          onClick={() => signOut()}
          className="text-[#aab2c2] text-[13px] font-semibold px-3 py-[7px] rounded-[9px] border border-borderInput hover:text-white hover:border-white/20 transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="ml-auto">
      <button
        onClick={() => {
          setOpen(true)
          setMsg(null)
        }}
        className="bg-primary-gradient text-white text-[13px] font-semibold px-4 py-[8px] rounded-[9px] shadow-btnGlow"
      >
        Sign in
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-card border border-borderCard rounded-[16px] p-[26px] shadow-shell"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white text-[20px] font-bold mb-1">
              {mode === 'in' ? 'Welcome back' : 'Create your account'}
            </div>
            <div className="text-textMuted text-[13.5px] mb-5">
              {mode === 'in' ? 'Sign in to sync your data across devices.' : 'Your dashboard syncs to the cloud once signed in.'}
            </div>

            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-3"
            />
            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-4"
            />

            {msg && (
              <div
                className="text-[13px] mb-3"
                style={{ color: msg.kind === 'error' ? '#f0915a' : '#5fd08a' }}
              >
                {msg.text}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || !email || !password}
              className="w-full bg-primary-gradient text-white text-sm font-bold py-[11px] rounded-[10px] shadow-btnGlow disabled:opacity-50"
            >
              {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}
            </button>

            <div className="text-center mt-4 text-textMuted text-[13px]">
              {mode === 'in' ? "No account? " : 'Already have one? '}
              <button
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in')
                  setMsg(null)
                }}
                className="text-[#7aa5ff] font-semibold"
              >
                {mode === 'in' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
