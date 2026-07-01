import { useState } from 'react'
import { useApp } from '../lib/app-context'
import type { ProviderConnection } from '../lib/types'

// Providers we expose for connection. The two with a real usage API are flagged
// so the UI can hint that the others are sandbox-only for now.
const PROVIDER_META = [
  { name: 'OpenAI', initial: 'O', color: '#10a37f', liveSync: true },
  { name: 'Anthropic', initial: 'A', color: '#d97757', liveSync: true },
  { name: 'Grok', initial: 'G', color: '#1d9bf0', liveSync: false },
  { name: 'Together AI', initial: 'T', color: '#0f6fff', liveSync: false },
  { name: 'Mistral', initial: 'M', color: '#ff7000', liveSync: false },
  { name: 'Gemini', initial: 'G', color: '#4285f4', liveSync: false },
  { name: 'Cohere', initial: 'C', color: '#9b6bff', liveSync: false },
  { name: 'Groq', initial: 'G', color: '#f55036', liveSync: false },
  { name: 'OpenRouter', initial: 'O', color: '#6566f1', liveSync: false },
]

const relativeTime = (ms: number | null): string => {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function ProvidersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, connectProvider, syncProvider, disconnectProvider } = useApp()
  const [formProvider, setFormProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [sandbox, setSandbox] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { text: string; err: boolean }>>({})

  if (!open) return null

  const byName = new Map<string, ProviderConnection>(data.providerConnections.map((c) => [c.provider, c]))
  const setNote = (p: string, text: string, err = false) => setMsg((m) => ({ ...m, [p]: { text, err } }))

  const resetForm = () => {
    setFormProvider(null)
    setApiKey('')
    setSandbox(false)
  }

  const submitConnect = async (provider: string) => {
    setBusy(provider)
    setNote(provider, '')
    const res = await connectProvider(provider, sandbox ? { mode: 'sandbox' } : { mode: 'live', apiKey })
    setBusy(null)
    if (res.error) setNote(provider, res.error, true)
    else {
      resetForm()
      setNote(provider, sandbox ? 'Connected in sandbox mode.' : 'Connected.')
    }
  }

  const doSync = async (provider: string) => {
    setBusy(provider)
    setNote(provider, '')
    const res = await syncProvider(provider)
    setBusy(null)
    if (res.error) setNote(provider, res.error, true)
    else setNote(provider, res.note ?? `Synced — ${res.inserted} new transaction${res.inserted === 1 ? '' : 's'}.`)
  }

  const doDisconnect = async (provider: string) => {
    setBusy(provider)
    const res = await disconnectProvider(provider)
    setBusy(null)
    if (res.error) setNote(provider, res.error, true)
    else setNote(provider, '')
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-borderCard rounded-[16px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-[26px]"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="text-white text-[20px] font-extrabold tracking-[-0.3px]">Connected Providers</div>
          <button onClick={onClose} className="text-textMuted text-[20px] leading-none cursor-pointer hover:text-white">
            ×
          </button>
        </div>
        <div className="text-textMuted text-[13.5px] font-medium mb-5">
          Link an AI provider to pull real usage automatically. Keys are stored encrypted server-side and never sent
          back to the browser.
        </div>

        <div className="flex flex-col gap-[10px]">
          {PROVIDER_META.map((p) => {
            const conn = byName.get(p.name)
            const isBusy = busy === p.name
            const note = msg[p.name]
            const formOpen = formProvider === p.name
            return (
              <div key={p.name} className="bg-app border border-borderCard rounded-[12px] p-[14px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-white text-[14px] font-bold"
                      style={{ background: p.color }}
                    >
                      {p.initial}
                    </span>
                    <div>
                      <div className="text-textSecondary text-[14.5px] font-bold flex items-center gap-2">
                        {p.name}
                        {conn && (
                          <span
                            className="text-[10.5px] font-bold px-[7px] py-[2px] rounded-[5px]"
                            style={{
                              background: conn.mode === 'sandbox' ? 'rgba(91,141,255,.16)' : 'rgba(43,182,115,.16)',
                              color: conn.mode === 'sandbox' ? '#7aa5ff' : '#5fd08a',
                            }}
                          >
                            {conn.mode === 'sandbox' ? 'Sandbox' : 'Live'}
                          </span>
                        )}
                      </div>
                      <div className="text-textMuted text-[12px] font-medium mt-[2px]">
                        {conn
                          ? `${conn.keyHint} · synced ${relativeTime(conn.lastSyncedAt)}`
                          : p.liveSync
                            ? 'Usage API available'
                            : 'Sandbox demo only for now'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {conn ? (
                      <>
                        <button
                          onClick={() => doSync(p.name)}
                          disabled={isBusy}
                          className="bg-primary-gradient text-white text-[12.5px] font-semibold px-[12px] py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? 'Syncing…' : 'Sync now'}
                        </button>
                        <button
                          onClick={() => doDisconnect(p.name)}
                          disabled={isBusy}
                          className="text-textMuted text-[12.5px] font-semibold px-[8px] py-[7px] rounded-[8px] cursor-pointer hover:text-[#f0915a] disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => (formOpen ? resetForm() : (resetForm(), setFormProvider(p.name)))}
                        className="text-[#7aa5ff] text-[12.5px] font-semibold px-[10px] py-[7px] rounded-[8px] cursor-pointer"
                      >
                        {formOpen ? 'Cancel' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>

                {formOpen && !conn && (
                  <div className="mt-3 flex flex-col gap-[10px]">
                    {!sandbox && (
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`${p.name} API key`}
                        className="w-full bg-input border border-borderInput rounded-[8px] px-[11px] py-[9px] text-textSecondary text-[13.5px] outline-none focus:border-[rgba(91,141,255,.5)]"
                      />
                    )}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
                      <span className="text-textMuted text-[12.5px] font-medium">
                        Sandbox mode — generate demo usage, no API key needed
                      </span>
                    </label>
                    {!sandbox && !p.liveSync && (
                      <div className="text-[#f0915a] text-[12px] font-medium">
                        {p.name} has no usage API yet — use sandbox mode, or connect and log usage manually.
                      </div>
                    )}
                    <button
                      onClick={() => submitConnect(p.name)}
                      disabled={isBusy || (!sandbox && apiKey.trim().length < 8)}
                      className="bg-primary-gradient text-white text-[13px] font-semibold py-[9px] rounded-[8px] cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? 'Connecting…' : sandbox ? 'Connect (sandbox)' : 'Validate & connect'}
                    </button>
                  </div>
                )}

                {note?.text && (
                  <div
                    className="mt-2 text-[12px] font-medium"
                    style={{ color: note.err ? '#f0915a' : '#5fd08a' }}
                  >
                    {note.text}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
