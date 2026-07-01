import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app-context'
import { fmtMoney } from '../lib/models'
import { fetchOpenRouterModels, costRating, type OpenRouterModel } from '../lib/openrouter'

// Browse OpenRouter's live model catalog and add models to the user's catalog.
// Added models are stored as custom models (provider 'OpenRouter' + apiModel)
// and become usable in the chat model picker, routed through OpenRouter.
export default function OpenRouterBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addCustomModel } = useApp()
  // null = not fetched yet; the catalog is cached by fetchOpenRouterModels.
  const [models, setModels] = useState<OpenRouterModel[] | null>(null)
  const [q, setQ] = useState('')
  const loading = models === null

  useEffect(() => {
    if (!open || models !== null) return
    let live = true
    fetchOpenRouterModels().then((list) => {
      if (live) setModels(list)
    })
    return () => {
      live = false
    }
  }, [open, models])

  const added = useMemo(
    () => new Set(data.customModels.filter((m) => m.provider === 'OpenRouter').map((m) => m.apiModel)),
    [data.customModels],
  )

  const filtered = useMemo(() => {
    const all = models ?? []
    const s = q.trim().toLowerCase()
    const list = s ? all.filter((m) => m.name.toLowerCase().includes(s) || m.id.toLowerCase().includes(s)) : all
    return list.slice(0, 200)
  }, [models, q])

  if (!open) return null

  const add = (m: OpenRouterModel) => {
    addCustomModel({
      name: m.name,
      provider: 'OpenRouter',
      apiModel: m.id,
      priceIn: m.priceIn,
      priceOut: m.priceOut,
      speed: 4,
      cost: costRating(m.priceOut),
      quality: 4,
    })
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-borderCard rounded-[16px] w-full max-w-[600px] max-h-[85vh] flex flex-col p-[24px]"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="text-white text-[20px] font-extrabold tracking-[-0.3px]">Browse OpenRouter models</div>
          <button onClick={onClose} className="text-textMuted text-[20px] leading-none cursor-pointer hover:text-white">
            ×
          </button>
        </div>
        <div className="text-textMuted text-[13.5px] font-medium mb-4">
          One OpenRouter key unlocks all of these. Add any model and pick it in chat — it routes through OpenRouter.
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search models — e.g. gpt-4o, claude, llama…"
          className="w-full bg-input border border-borderInput rounded-[9px] px-[12px] py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-3"
        />

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="text-textMuted text-sm text-center py-10">Loading OpenRouter catalog…</div>
          ) : filtered.length === 0 ? (
            <div className="text-textMuted text-sm text-center py-10">No models match “{q}”.</div>
          ) : (
            filtered.map((m) => {
              const isAdded = added.has(m.id)
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-[11px] border-b border-[rgba(255,255,255,.05)]"
                >
                  <div className="min-w-0">
                    <div className="text-textSecondary text-[14px] font-semibold truncate">{m.name}</div>
                    <div className="text-textMuted text-[12px] font-medium truncate">
                      {m.id} · in {fmtMoney(m.priceIn)}/1M · out {fmtMoney(m.priceOut)}/1M
                    </div>
                  </div>
                  <button
                    disabled={isAdded}
                    onClick={() => add(m)}
                    className="flex-none text-[12.5px] font-semibold px-[12px] py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50"
                    style={{
                      background: isAdded ? 'rgba(255,255,255,.06)' : 'rgba(91,141,255,.18)',
                      color: isAdded ? '#8b93a5' : '#7aa5ff',
                    }}
                  >
                    {isAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="text-textDim text-[11.5px] font-medium mt-3">
          {models && models.length > 0 && `${models.length} models available`}
        </div>
      </div>
    </div>
  )
}
