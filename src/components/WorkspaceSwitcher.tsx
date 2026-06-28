import { useState } from 'react'
import { useApp } from '../lib/store'

// Workspace switcher (top nav) + a manage-members/invite modal. Shows the active
// workspace; lets users switch, create, join by code, and (owners) invite/remove.
export default function WorkspaceSwitcher() {
  const {
    data,
    session,
    supabaseEnabled,
    switchWorkspace,
    createWorkspace,
    joinWorkspace,
    createInviteCode,
    removeWorkspaceMember,
    leaveWorkspace,
  } = useApp()
  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [codeDraft, setCodeDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [invite, setInvite] = useState<string | null>(null)

  const active = data.workspaces.find((w) => w.id === data.activeWorkspaceId)
  const signedIn = Boolean(session)

  const reset = () => {
    setCreating(false)
    setJoining(false)
    setNameDraft('')
    setCodeDraft('')
    setNote('')
  }

  const doCreate = async () => {
    setBusy(true)
    const res = await createWorkspace(nameDraft)
    setBusy(false)
    if (res.error) setNote(res.error)
    else {
      reset()
      setOpen(false)
    }
  }

  const doJoin = async () => {
    setBusy(true)
    const res = await joinWorkspace(codeDraft)
    setBusy(false)
    if (res.error) setNote(res.error)
    else {
      reset()
      setOpen(false)
    }
  }

  const genInvite = async () => {
    setBusy(true)
    const res = await createInviteCode()
    setBusy(false)
    if (res.code) {
      setInvite(res.code)
      try {
        await navigator.clipboard.writeText(res.code)
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-[12px] py-[8px] rounded-[9px] border border-borderInput hover:border-white/20 cursor-pointer"
        title="Workspace"
      >
        <span className="w-[18px] h-[18px] rounded-[5px] bg-primary-gradient flex items-center justify-center text-white text-[10px] font-bold">
          {(active?.name ?? 'P').charAt(0).toUpperCase()}
        </span>
        <span className="text-textTertiary text-[13.5px] font-semibold max-w-[120px] truncate">
          {active?.name ?? 'Personal'}
        </span>
        <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
          <path d="M2 4L5.5 7.5L9 4" stroke="#8b93a5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); reset() }} />
          <div className="absolute left-0 mt-2 w-[260px] z-50 bg-card border border-borderCard rounded-[12px] shadow-shell overflow-hidden">
            <div className="px-[14px] py-[10px] text-textMuted text-[11px] font-bold uppercase tracking-[0.5px] border-b border-borderSubtle">
              Workspaces
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {data.workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { switchWorkspace(w.id); setOpen(false) }}
                  className="w-full flex items-center justify-between px-[14px] py-[10px] cursor-pointer hover:bg-[rgba(255,255,255,.03)]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-[16px] h-[16px] rounded-[4px] bg-primary-gradient flex-none" />
                    <span className="text-textSecondary text-[13.5px] font-semibold truncate">{w.name}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-none">
                    <span className="text-textDim text-[11px] font-medium">{w.role}</span>
                    {w.id === data.activeWorkspaceId && <span className="text-accentGreen text-[12px]">✓</span>}
                  </span>
                </button>
              ))}
            </div>

            {!signedIn ? (
              <div className="px-[14px] py-[10px] text-textMuted text-[12px] font-medium border-t border-borderSubtle">
                Sign in to create or join team workspaces.
              </div>
            ) : creating ? (
              <div className="p-[12px] border-t border-borderSubtle flex flex-col gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Workspace name"
                  className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[7px] text-textSecondary text-[13px] outline-none focus:border-[rgba(91,141,255,.5)]"
                />
                <div className="flex gap-2">
                  <button onClick={doCreate} disabled={busy} className="flex-1 bg-primary-gradient text-white text-[12.5px] font-semibold py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50">Create</button>
                  <button onClick={reset} className="text-textMuted text-[12.5px] font-semibold px-3 rounded-[8px] border border-borderInput cursor-pointer">Cancel</button>
                </div>
                {note && <div className="text-[#f0915a] text-[12px]">{note}</div>}
              </div>
            ) : joining ? (
              <div className="p-[12px] border-t border-borderSubtle flex flex-col gap-2">
                <input
                  autoFocus
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value)}
                  placeholder="Invite code"
                  className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[7px] text-textSecondary text-[13px] outline-none focus:border-[rgba(91,141,255,.5)]"
                />
                <div className="flex gap-2">
                  <button onClick={doJoin} disabled={busy} className="flex-1 bg-primary-gradient text-white text-[12.5px] font-semibold py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50">Join</button>
                  <button onClick={reset} className="text-textMuted text-[12.5px] font-semibold px-3 rounded-[8px] border border-borderInput cursor-pointer">Cancel</button>
                </div>
                {note && <div className="text-[#f0915a] text-[12px]">{note}</div>}
              </div>
            ) : (
              <div className="p-[8px] border-t border-borderSubtle flex flex-col">
                <button onClick={() => setCreating(true)} className="text-left text-[#7aa5ff] text-[13px] font-semibold px-[10px] py-[8px] rounded-[7px] hover:bg-[rgba(255,255,255,.03)] cursor-pointer">＋ New workspace</button>
                <button onClick={() => setJoining(true)} className="text-left text-[#7aa5ff] text-[13px] font-semibold px-[10px] py-[8px] rounded-[7px] hover:bg-[rgba(255,255,255,.03)] cursor-pointer">Join with code</button>
                <button onClick={() => { setManageOpen(true); setOpen(false) }} className="text-left text-textTertiary text-[13px] font-semibold px-[10px] py-[8px] rounded-[7px] hover:bg-[rgba(255,255,255,.03)] cursor-pointer">Manage members</button>
              </div>
            )}
          </div>
        </>
      )}

      {manageOpen && (
        <div onClick={() => { setManageOpen(false); setInvite(null) }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-borderCard rounded-[16px] w-full max-w-[460px] p-[24px]">
            <div className="flex items-start justify-between mb-1">
              <div className="text-white text-[19px] font-extrabold tracking-[-0.3px]">{active?.name ?? 'Workspace'} — members</div>
              <button onClick={() => { setManageOpen(false); setInvite(null) }} className="text-textMuted text-[20px] leading-none cursor-pointer hover:text-white">×</button>
            </div>
            <div className="text-textMuted text-[13px] font-medium mb-4">
              Members share this workspace's spend, projects, and budgets. Chats stay private to each person.
            </div>

            <div className="flex flex-col gap-[2px] mb-4">
              {data.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between py-[9px] border-b border-[rgba(255,255,255,.05)]">
                  <span className="text-textSecondary text-[13.5px] font-medium truncate">{m.email}</span>
                  <span className="flex items-center gap-3 flex-none">
                    <span className="text-textDim text-[12px] font-semibold">{m.role}</span>
                    {active?.role === 'owner' && m.role !== 'owner' && (
                      <button onClick={() => removeWorkspaceMember(m.userId)} className="text-textMuted text-[12px] font-semibold cursor-pointer hover:text-[#f0915a]">Remove</button>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {active?.role === 'owner' && (
              <div className="mb-4">
                <button onClick={genInvite} disabled={busy} className="bg-primary-gradient text-white text-[13px] font-semibold px-[14px] py-[9px] rounded-[9px] cursor-pointer disabled:opacity-50">
                  Generate invite code
                </button>
                {invite && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[7px] text-textSecondary text-[13px] font-mono">{invite}</code>
                    <span className="text-accentGreen text-[12px] font-semibold">copied — share it to invite</span>
                  </div>
                )}
              </div>
            )}

            {active?.role !== 'owner' && (
              <button onClick={() => { leaveWorkspace(); setManageOpen(false) }} className="text-[#f0915a] text-[13px] font-semibold cursor-pointer hover:underline">
                Leave workspace
              </button>
            )}
          </div>
        </div>
      )}
      {!supabaseEnabled && null}
    </div>
  )
}
