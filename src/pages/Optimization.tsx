import { useState } from 'react'
import Shell from '../components/Shell'
import { Toggle } from '../components/ui'
import { useApp } from '../lib/app-context'
import { MODELS, combinedModels, defaultFreeRouteIdx, bestFreeModel } from '../lib/models'
import { totalSaved, savedPct as savedPctOf, freeModelSavings } from '../lib/selectors'
import OpenRouterBrowser from '../components/OpenRouterBrowser'

const ruleDefs = [
  { task: 'Tax', color: '#3ec98a' },
  { task: 'Research', color: '#5b8dff' },
  { task: 'Code', color: '#9b6bff' },
  { task: 'General', color: '#f0915a' },
  { task: 'Triage', color: '#5fd08a' },
]

function Segs({ n, color }: { n: number; color: string }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-[11px] h-[7px] rounded-[2px]"
          style={{ background: i < n ? color : '#222a38' }}
        />
      ))}
    </div>
  )
}

const emptyForm = { name: '', provider: '', priceIn: '', priceOut: '', speed: 3, cost: 3, quality: 3 }

export default function Optimization() {
  const { data, setOptimization, cycleRoute, addCustomModel, deleteCustomModel } = useApp()
  const { routeIdx, aggr, engineOn, caching, trim, applied } = data.optimization
  const catalog = combinedModels(data.customModels)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [browseOpen, setBrowseOpen] = useState(false)

  const submitModel = () => {
    const priceIn = parseFloat(form.priceIn)
    const priceOut = parseFloat(form.priceOut)
    if (!form.name.trim() || !form.provider.trim() || isNaN(priceIn) || isNaN(priceOut)) return
    addCustomModel({
      name: form.name.trim(),
      provider: form.provider.trim(),
      priceIn,
      priceOut,
      speed: form.speed,
      cost: form.cost,
      quality: form.quality,
    })
    setForm(emptyForm)
    setAdding(false)
  }

  // Headline savings: blend realized savings from transactions with a forward
  // estimate that scales with compression aggressiveness.
  const realizedSaved = totalSaved(data.transactions)
  const savPct = Math.round(30 + aggr * 0.28)
  const savDollars = '$' + Math.round(Math.max(realizedSaved, (2638 * savPct) / 100)).toLocaleString()
  const realizedPct = savedPctOf(data.transactions)
  const aggrLabel = aggr < 35 ? 'Low' : aggr < 70 ? 'Balanced' : 'High'

  // Are all routing rules already pointed at free models?
  const freeIdx = defaultFreeRouteIdx()
  const allFreeRouted = routeIdx.length > 0 && routeIdx.every((v) => catalog[v]?.free)
  const freeSavings = freeModelSavings(data.transactions)
  const applyFreeRouting = () => setOptimization({ routeIdx: freeIdx, applied: false })

  const handleAggrClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 100)))
    setOptimization({ aggr: pct, applied: false })
  }

  return (
    <Shell>
      <div className="px-[30px] py-[26px] pb-[30px] max-md:px-4 max-md:py-5">
        <div className="flex items-start justify-between mb-[22px] flex-wrap gap-3">
          <div>
            <div className="text-white text-[28px] font-extrabold tracking-[-0.5px] max-md:text-[24px]">
              Auto-Optimization Engine
            </div>
            <div className="text-textMuted text-[15px] font-medium mt-[5px]">
              Route tasks to the best model, compress prompts, and watch the savings add up.
            </div>
          </div>
          <div
            onClick={() => setOptimization({ engineOn: !engineOn })}
            className="flex items-center gap-[11px] bg-card border border-borderInput px-4 py-[9px] rounded-[11px] cursor-pointer"
          >
            <span className="text-textTertiary text-sm font-semibold">Engine</span>
            <Toggle on={engineOn} onClick={() => setOptimization({ engineOn: !engineOn })} activeColor="#2bb673" />
            <span
              className="text-sm font-bold"
              style={{ color: engineOn ? '#5fd08a' : '#8b93a5' }}
            >
              {engineOn ? 'On' : 'Off'}
            </span>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-4 rounded-[14px] border border-[rgba(43,182,115,.32)] p-[16px_20px] mb-[18px] max-md:flex-col max-md:items-start max-md:gap-3"
          style={{ background: 'linear-gradient(120deg,#10241c,#0e1620)' }}
        >
          <div className="flex items-center gap-[14px] min-w-0">
            <span className="flex-none w-[34px] h-[34px] rounded-[9px] bg-[rgba(43,182,115,.16)] flex items-center justify-center text-[18px]">
              💚
            </span>
            <div className="min-w-0">
              <div className="text-white text-[15.5px] font-bold">
                {allFreeRouted
                  ? `All tasks routed to ${bestFreeModel().name} — you're paying $0 on routed calls`
                  : 'Route every task to a free model and pay $0'}
              </div>
              <div className="text-textMuted text-[13px] font-medium mt-[2px]">
                {allFreeRouted
                  ? 'Your routing is fully optimized for free-tier models.'
                  : `Free-tier models cover most tasks at zero cost${freeSavings > 0 ? ` — up to $${Math.round(freeSavings).toLocaleString()} of recent spend was avoidable` : ''}.`}
              </div>
            </div>
          </div>
          {!allFreeRouted && (
            <button
              onClick={applyFreeRouting}
              className="flex-none bg-[#2bb673] text-white text-[13px] font-bold px-[14px] py-[9px] rounded-[9px] cursor-pointer hover:brightness-110"
            >
              Apply free routing
            </button>
          )}
        </div>

        <div className="grid grid-cols-[1fr_1fr_1.12fr] gap-[18px] items-start max-lg:grid-cols-1">
          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="text-textSecondary text-[16.5px] font-bold mb-[5px]">Routing Rules</div>
            <div className="text-textMuted text-[13px] font-medium mb-4">
              Tap a row to cycle the model for that task.
            </div>
            <div className="flex flex-col gap-[10px]">
              {ruleDefs.map((rd, i) => {
                const m = catalog[routeIdx[i]] ?? catalog[0]
                return (
                  <div
                    key={rd.task}
                    onClick={() => cycleRoute(i)}
                    className="flex items-center justify-between p-[13px_14px] rounded-[11px] bg-app border border-borderCard cursor-pointer hover:border-[rgba(91,141,255,.4)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-[9px] h-[9px] rounded-[3px]"
                          style={{ background: rd.color }}
                        />
                        <span className="text-textTertiary text-[13.5px] font-semibold">
                          {rd.task}
                        </span>
                      </div>
                      <div className="text-textSecondary text-[15px] font-bold mt-[6px] flex items-center gap-[7px]">
                        {m.name}
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path
                            d="M2 4L5.5 7.5L9 4"
                            stroke="#6c7488"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="bg-[rgba(43,182,115,.16)] text-accentGreen text-[13px] font-bold px-[10px] py-1 rounded-[7px]">
                      {m.sav}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-[18px]">
            <div
              className="rounded-[14px] border border-[rgba(91,141,255,.22)] p-[22px]"
              style={{ background: 'linear-gradient(150deg,#16243f,#11161f)' }}
            >
              <div className="flex items-center justify-between mb-[6px]">
                <span className="text-[#aeb9d0] text-[15px] font-semibold">
                  Estimated Monthly Savings
                </span>
                <span className="bg-[rgba(43,182,115,.18)] text-accentGreen text-[15px] font-extrabold px-3 py-1 rounded-[8px]">
                  {Math.max(savPct, realizedPct)}%
                </span>
              </div>
              <div className="text-white text-[46px] font-extrabold tracking-[-1.5px] leading-[1.1]">
                {savDollars}
              </div>
              <div className="text-textMuted text-[13.5px] font-medium mt-[6px]">
                vs. running every call on a frontier model
              </div>
            </div>

            <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
              <div className="text-textSecondary text-[16.5px] font-bold mb-[18px]">
                Compression Settings
              </div>
              <div className="flex items-center justify-between mb-[9px]">
                <span className="text-textTertiary text-sm font-semibold">Aggressiveness</span>
                <span className="text-[#7aa5ff] text-sm font-bold">{aggrLabel}</span>
              </div>
              <div
                onClick={handleAggrClick}
                className="relative h-3 bg-[#1d2532] rounded-[99px] cursor-pointer my-1"
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-[99px] pointer-events-none"
                  style={{ width: `${aggr}%`, background: 'linear-gradient(90deg,#174dcc,#3770f0)' }}
                />
                <div
                  className="absolute top-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-[#5b8dff] pointer-events-none"
                  style={{ left: `${aggr}%`, transform: 'translate(-50%,-50%)', boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}
                />
              </div>
              <div className="flex justify-between mb-[18px]">
                <span className="text-textDisabled text-xs font-medium">Conservative</span>
                <span className="text-textDisabled text-xs font-medium">Maximum</span>
              </div>

              <div
                onClick={() => setOptimization({ caching: !caching })}
                className="flex items-center justify-between py-[11px] cursor-pointer"
              >
                <span className="text-textTertiary text-sm font-medium">Response caching</span>
                <Toggle on={caching} onClick={() => setOptimization({ caching: !caching })} />
              </div>
              <div
                onClick={() => setOptimization({ trim: !trim })}
                className="flex items-center justify-between py-[11px] cursor-pointer"
              >
                <span className="text-textTertiary text-sm font-medium">Trim system prompts</span>
                <Toggle on={trim} onClick={() => setOptimization({ trim: !trim })} />
              </div>
            </div>
          </div>

          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-textSecondary text-[16.5px] font-bold">
                Model Performance Matrix
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBrowseOpen(true)}
                  className="text-[#7aa5ff] text-[13px] font-semibold cursor-pointer"
                >
                  Browse OpenRouter
                </button>
                <button
                  onClick={() => setAdding((a) => !a)}
                  className="text-[#7aa5ff] text-[13px] font-semibold cursor-pointer"
                >
                  {adding ? 'Cancel' : '+ Add Model'}
                </button>
              </div>
            </div>

            {adding && (
              <div className="bg-app border border-borderCard rounded-[11px] p-[14px] mb-4 flex flex-col gap-[8px]">
                <div className="grid grid-cols-2 gap-[8px]">
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Model name"
                    className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[8px] text-textSecondary text-[13.5px] outline-none focus:border-[rgba(91,141,255,.5)]"
                  />
                  <input
                    value={form.provider}
                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                    placeholder="Provider"
                    className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[8px] text-textSecondary text-[13.5px] outline-none focus:border-[rgba(91,141,255,.5)]"
                  />
                  <input
                    value={form.priceIn}
                    onChange={(e) => setForm((f) => ({ ...f, priceIn: e.target.value }))}
                    placeholder="$ / 1M input tok"
                    inputMode="decimal"
                    className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[8px] text-textSecondary text-[13.5px] outline-none focus:border-[rgba(91,141,255,.5)]"
                  />
                  <input
                    value={form.priceOut}
                    onChange={(e) => setForm((f) => ({ ...f, priceOut: e.target.value }))}
                    placeholder="$ / 1M output tok"
                    inputMode="decimal"
                    className="bg-input border border-borderInput rounded-[8px] px-[10px] py-[8px] text-textSecondary text-[13.5px] outline-none focus:border-[rgba(91,141,255,.5)]"
                  />
                </div>
                {(['speed', 'cost', 'quality'] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-textMuted text-[12.5px] font-semibold capitalize">{k}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          onClick={() => setForm((f) => ({ ...f, [k]: n }))}
                          className="w-[16px] h-[9px] rounded-[2px] cursor-pointer"
                          style={{ background: n <= form[k] ? '#5b8dff' : '#222a38' }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={submitModel}
                  className="bg-primary-gradient text-white text-[13.5px] font-semibold py-[9px] rounded-[8px] mt-1 cursor-pointer"
                >
                  Save Model
                </button>
              </div>
            )}

            <div className="max-md:overflow-x-auto">
            <div className="max-md:min-w-[440px]">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 pb-3 border-b border-[rgba(255,255,255,.07)]">
              <span className="text-textMuted text-[13px] font-semibold">Model</span>
              <span className="text-textMuted text-[13px] font-semibold">Speed</span>
              <span className="text-textMuted text-[13px] font-semibold">Cost</span>
              <span className="text-textMuted text-[13px] font-semibold">Quality</span>
              <span />
            </div>
            {catalog.map((m, i) => {
              const isCustom = i >= MODELS.length
              return (
                <div
                  key={isCustom ? (m.id ?? m.name) : m.name}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-center py-[13px] border-b border-[rgba(255,255,255,.04)]"
                >
                  <span className="text-[#d6dbe6] text-sm font-semibold flex items-center flex-wrap gap-x-[6px]">
                    {m.name}
                    {m.free && (
                      <span className="bg-[rgba(43,182,115,.16)] text-accentGreen text-[10.5px] font-bold px-[6px] py-[1px] rounded-[5px]">
                        Free
                      </span>
                    )}
                    {isCustom && <span className="text-textMuted text-[11px] font-medium">· {m.provider}</span>}
                  </span>
                  <Segs n={m.speed} color="#5b8dff" />
                  <Segs n={m.cost} color="#3ec98a" />
                  <Segs n={m.quality} color="#9b6bff" />
                  {isCustom && m.id ? (
                    <button
                      onClick={() => deleteCustomModel(m.id!)}
                      className="text-textMuted text-[12px] font-semibold cursor-pointer hover:text-[#f0915a]"
                    >
                      Remove
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              )
            })}
            </div>
            </div>
            <div className="flex gap-4 mt-[14px]">
              <div className="flex items-center gap-[6px]">
                <span className="w-[9px] h-[9px] rounded-[2px] bg-[#5b8dff]" />
                <span className="text-textMuted text-xs">Speed</span>
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="w-[9px] h-[9px] rounded-[2px] bg-accentGreenMid" />
                <span className="text-textMuted text-xs">Cost</span>
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="w-[9px] h-[9px] rounded-[2px] bg-accentPurple" />
                <span className="text-textMuted text-xs">Quality</span>
              </div>
            </div>
          </div>
        </div>

        <div
          onClick={() => setOptimization({ applied: true })}
          className="mt-5 rounded-2xl p-[18px] text-center cursor-pointer shadow-btnGlow"
          style={{ background: applied ? '#2bb673' : 'linear-gradient(90deg,#174dcc,#3770f0)' }}
        >
          <span className="text-white text-[17px] font-bold inline-flex items-center gap-[10px]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 9.5L7 13.5L15 4.5"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {applied ? 'Applied to all future calls' : 'Apply to all future calls'}
          </span>
        </div>
      </div>
      <OpenRouterBrowser open={browseOpen} onClose={() => setBrowseOpen(false)} />
    </Shell>
  )
}
