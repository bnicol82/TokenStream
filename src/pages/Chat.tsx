import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '../components/Shell'
import { useApp } from '../lib/app-context'
import {
  estimateCost,
  estimateForModel,
  combinedModels,
  bestFreeModel,
  cheapestModel,
  fmtMoney,
  FREE_MODEL_NAMES,
} from '../lib/models'
import { PROJECT_COLORS } from '../lib/projects'

const tagOptions = ['Tax Planning', 'Business Research', 'Code', 'General']

export default function Chat() {
  const {
    data,
    newConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    setRoiTag,
    setConversationProject,
    setConversationModel,
    addProject,
  } = useApp()
  const { conversations, activeConversationId, optimization, projects, customModels } = data

  const active = conversations.find((c) => c.id === activeConversationId) ?? conversations[0]

  const [text, setText] = useState('')
  const [compress, setCompress] = useState(true)
  const [route, setRoute] = useState(optimization.engineOn)
  const [cache, setCache] = useState(optimization.caching)
  // Breakdown panel starts open on desktop, closed on phones (it overlays there).
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  // Conversation list drawer (phones only — always visible on desktop).
  const [chatsOpen, setChatsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [newProject, setNewProject] = useState('') // inline project name; '' = not creating
  const [creatingProject, setCreatingProject] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const catalog = useMemo(() => combinedModels(customModels), [customModels])

  // Keep the newest message in view — without this, sent messages land below
  // the fold and look like they were never added (especially on phones).
  const messagesRef = useRef<HTMLDivElement>(null)
  const messageCount = active?.messages.length ?? 0
  const lastMessageText = active?.messages[active.messages.length - 1]?.text ?? ''
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messageCount, lastMessageText, activeConversationId])
  // The model the active conversation is pinned to (null/undefined = Auto).
  const pinnedName = active?.modelName ?? null
  const pinned = pinnedName ? catalog.find((m) => m.name === pinnedName) : null

  // Composer cost estimate: use the pinned model if set, else auto-routing.
  const calc = useMemo(() => {
    const opts = { compress, route, cache, aggr: optimization.aggr }
    return pinned ? estimateForModel(text || ' ', opts, pinned) : estimateCost(text || ' ', opts)
  }, [text, compress, route, cache, optimization.aggr, pinned])

  // Per-model estimates for the picker dropdown.
  const modelEstimates = useMemo(
    () =>
      catalog.map((m) => ({
        model: m,
        cost: estimateForModel(text || ' ', { compress, route, cache, aggr: optimization.aggr }, m).optCost,
      })),
    [catalog, text, compress, route, cache, optimization.aggr],
  )

  // Recommend a cheaper model only when a PAID model is pinned and something
  // cheaper exists. No nudge when on Auto or an already-free model.
  const recommendation = useMemo(() => {
    if (!pinned || pinned.free) return null
    const cheaper = cheapestModel(catalog)
    if (!cheaper || cheaper.name === pinned.name) return null
    const pinnedCost = estimateForModel(text || ' ', { compress, route, cache, aggr: optimization.aggr }, pinned).optCost
    const cheapCost = estimateForModel(text || ' ', { compress, route, cache, aggr: optimization.aggr }, cheaper).optCost
    if (cheapCost >= pinnedCost) return null
    return { model: cheaper, savings: pinnedCost - cheapCost }
  }, [pinned, catalog, text, compress, route, cache, optimization.aggr])

  const filteredConvos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations
  }, [conversations, search])

  const send = () => {
    if (!text.trim() || !active) return
    sendMessage(active.id, text.trim(), { compress, route, cache })
    setText('')
  }

  const addProjectInline = () => {
    const name = newProject.trim()
    if (!name || !active) return
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
    const created = addProject({ name, color, keywords: [], budget: 0 })
    setConversationProject(active.id, created.id)
    setNewProject('')
    setCreatingProject(false)
  }

  const spent = active ? active.messages.reduce((s, m) => s + (m.cost ?? 0), 0) : 0
  const totalSaved = conversations
    .flatMap((c) => c.messages)
    .reduce((s, m) => s + (m.usage ? m.usage.baseCost - m.usage.cost : 0), 0)

  const chips = [
    { label: 'Prompt compression', on: compress, set: setCompress, dot: '#3ec98a' },
    { label: 'Smart model routing', on: route, set: setRoute, dot: '#5b8dff' },
    { label: 'Context caching', on: cache, set: setCache, dot: '#9b6bff' },
  ]

  return (
    <Shell>
      <div className="flex h-[640px] max-md:h-[calc(100dvh-129px)]">
        {/* Backdrop for the mobile conversation drawer */}
        {chatsOpen && <div className="md:hidden fixed inset-0 z-[59] bg-black/60" onClick={() => setChatsOpen(false)} />}
        {/* Sidebar — inline on desktop, slide-over drawer on phones */}
        <div
          className={`flex-none w-[236px] border-r border-borderSubtle p-[20px_16px] flex flex-col min-h-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[60] max-md:w-[280px] max-md:bg-app ${chatsOpen ? '' : 'max-md:hidden'}`}
        >
          <button
            onClick={() => {
              newConversation()
              setChatsOpen(false)
            }}
            className="flex items-center justify-center gap-[9px] bg-primary-gradient text-white text-[14.5px] font-semibold p-[11px] rounded-[10px] cursor-pointer mb-4"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 2v11M2 7.5h11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New Chat
          </button>
          <div className="flex items-center gap-[9px] bg-input border border-borderInput p-[9px_13px] rounded-[9px] mb-5">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#6c7488" strokeWidth="1.5" />
              <path d="M10 10L13.5 13.5" stroke="#6c7488" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="bg-transparent border-none outline-none text-textSecondary text-[13.5px] w-full placeholder:text-textDisabled"
            />
          </div>
          <div className="text-textMuted text-xs font-bold tracking-[0.6px] uppercase mb-[10px]">Recent</div>
          <div className="flex flex-col gap-1 overflow-y-auto min-h-0">
            {filteredConvos.map((c) => {
              const isActive = c.id === active?.id
              const isRenaming = renamingId === c.id
              const commitRename = () => {
                renameConversation(c.id, renameDraft)
                setRenamingId(null)
              }
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (isRenaming) return
                    selectConversation(c.id)
                    setChatsOpen(false)
                  }}
                  className="group relative p-[11px_12px] rounded-[9px] cursor-pointer hover:bg-cardHover"
                  style={{ background: isActive ? '#161c27' : 'transparent' }}
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onBlur={commitRename}
                      className="w-full bg-input border border-borderInput rounded-[6px] px-[8px] py-[4px] text-sm text-white outline-none focus:border-[rgba(91,141,255,.5)]"
                    />
                  ) : (
                    <>
                      <div
                        className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis pr-[40px]"
                        style={{ color: isActive ? '#fff' : '#c4cad6' }}
                      >
                        {c.title}
                      </div>
                      <div className="flex items-center gap-[7px] mt-1">
                        <span className="w-[7px] h-[7px] rounded-[2px]" style={{ background: c.tagColor }} />
                        <span className="text-textDim text-xs font-medium">
                          {c.tag}
                          {c.messages.length > 0 && ` · ${fmtMoney(c.messages.reduce((s, m) => s + (m.cost ?? 0), 0))}`}
                        </span>
                      </div>
                      <div className="absolute top-[9px] right-[8px] hidden group-hover:flex items-center gap-[2px]">
                        <button
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingId(c.id)
                            setRenameDraft(c.title)
                          }}
                          className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center hover:bg-[rgba(255,255,255,.08)]"
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5Z" stroke="#9aa3b5" strokeWidth="1.3" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete chat "${c.title}"?`)) deleteConversation(c.id)
                          }}
                          className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center hover:bg-[rgba(255,255,255,.08)]"
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M3 4h8M5.5 4V3h3v1M4.5 4l.5 7h4l.5-7" stroke="#9aa3b5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-auto pt-4 border-t border-borderCard">
            <div className="flex items-center justify-between">
              <span className="text-textMuted text-[12.5px] font-semibold">This month saved</span>
              <span className="text-accentGreen text-sm font-extrabold">{fmtMoney(Math.max(totalSaved, 0.892))}</span>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 p-[18px_26px] border-b border-borderSubtle max-md:p-[12px_16px]">
            <button
              onClick={() => setChatsOpen(true)}
              aria-label="Open conversations"
              className="md:hidden flex-none w-[36px] h-[36px] rounded-[9px] border border-borderInput flex items-center justify-center cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="#c4cad6" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="text-white text-[17px] font-bold truncate">{active?.title ?? 'New Chat'}</div>
              <div className="flex items-center gap-2 mt-[3px] max-md:hidden">
                <span className="w-[7px] h-[7px] rounded-full bg-[#2bb673]" />
                <span className="text-textMuted text-[13px] font-medium">
                  {optimization.engineOn ? 'Auto-routing on' : 'Auto-routing off'} ·{' '}
                  {active?.messages.length ?? 0} messages · {fmtMoney(spent)} spent
                </span>
              </div>
              {active && (
                <div className="flex items-center gap-[7px] mt-[7px]">
                  <span className="text-textDim text-[12px] font-semibold">Project</span>
                  <span
                    className="w-[8px] h-[8px] rounded-[2px]"
                    style={{ background: projects.find((p) => p.id === active.projectId)?.color ?? '#5a6478' }}
                  />
                  {creatingProject ? (
                    <>
                      <input
                        autoFocus
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addProjectInline()
                          if (e.key === 'Escape') {
                            setCreatingProject(false)
                            setNewProject('')
                          }
                        }}
                        placeholder="New project name"
                        className="bg-input border border-borderInput rounded-[7px] px-[8px] py-[3px] text-textSecondary text-[12.5px] outline-none focus:border-[rgba(91,141,255,.5)] w-[150px]"
                      />
                      <button onClick={addProjectInline} className="text-[#7aa5ff] text-[12px] font-semibold cursor-pointer">
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setCreatingProject(false)
                          setNewProject('')
                        }}
                        className="text-textMuted text-[12px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <select
                      value={active.projectId ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setCreatingProject(true)
                          return
                        }
                        setConversationProject(active.id, e.target.value || null)
                      }}
                      className="bg-input border border-borderInput rounded-[7px] px-[8px] py-[3px] text-textSecondary text-[12.5px] outline-none cursor-pointer focus:border-[rgba(91,141,255,.5)]"
                    >
                      <option value="">Unassigned</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="__new__">+ New project…</option>
                    </select>
                  )}
                </div>
              )}
            </div>
            <div
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex flex-none items-center gap-2 text-[13.5px] font-semibold px-[14px] py-2 rounded-[9px] cursor-pointer border max-md:px-[10px]"
              style={{
                background: panelOpen ? 'rgba(91,141,255,.16)' : 'transparent',
                color: panelOpen ? '#7aa5ff' : '#9aa3b5',
                borderColor: panelOpen ? 'rgba(91,141,255,.4)' : 'rgba(255,255,255,.1)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 4h11M2 7.5h11M2 11h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="max-md:hidden">Breakdown</span>
            </div>
          </div>

          <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto p-[24px_26px] flex flex-col gap-5 max-md:p-[16px_14px]">
            {active && active.messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-textMuted">
                <div className="text-textTertiary text-base font-semibold">Start the conversation</div>
                <div className="text-sm max-w-[360px]">
                  Type below — TokenStream estimates the cost, compresses your prompt, and routes to the
                  cheapest model that can do the job.
                </div>
              </div>
            )}
            {active?.messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex flex-col items-end">
                  <div
                    className="max-w-[78%] max-md:max-w-[92%] text-white text-[14.5px] font-medium leading-[1.55] p-[14px_17px] rounded-[14px_14px_4px_14px]"
                    style={{ background: 'linear-gradient(90deg,#174dcc,#3770f0)' }}
                  >
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start">
                  <div className="max-w-[78%] max-md:max-w-[92%] bg-card border border-[rgba(255,255,255,.07)] text-[#d6dbe6] text-[14.5px] font-medium leading-[1.55] p-[14px_17px] rounded-[14px_14px_14px_4px]">
                    {m.text}
                  </div>
                  <div className="flex items-center gap-[9px] mt-2 pl-[2px]">
                    {m.model && (
                      <span className="bg-[#1d2532] text-[#aab2c2] text-xs font-bold px-[9px] py-[3px] rounded-[6px]">{m.model}</span>
                    )}
                    {m.opt && <span className="text-accentGreen text-xs font-semibold">{m.opt}</span>}
                    {m.cost != null && <span className="text-textDim text-xs font-medium">{fmtMoney(m.cost)}</span>}
                  </div>
                  {m.usage && (
                    <div className="w-[78%] max-md:w-full mt-3 bg-card border border-[rgba(255,255,255,.07)] rounded-xl p-[15px_17px]">
                      <div className="flex items-center justify-between mb-[13px]">
                        <span className="text-textSecondary text-sm font-bold">Usage &amp; Savings</span>
                        <svg width="62" height="22" viewBox="0 0 62 22" fill="none">
                          <path d="M2 18 C12 16 16 10 26 11 C36 12 40 4 60 2" stroke="#5fd08a" strokeWidth="2" fill="none" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="flex gap-[26px] flex-wrap mb-[14px]">
                        <div>
                          <div className="text-textDim text-[11px] font-semibold uppercase tracking-[0.4px]">Tokens used</div>
                          <div className="text-textSecondary text-[17px] font-bold mt-[3px]">{m.usage.tokens.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-textDim text-[11px] font-semibold uppercase tracking-[0.4px]">Cost</div>
                          <div className="flex items-baseline gap-[7px] mt-[3px]">
                            <span className="text-textSecondary text-[17px] font-bold">{fmtMoney(m.usage.cost)}</span>
                            <span className="text-textDisabled text-[12.5px] line-through">{fmtMoney(m.usage.baseCost)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-textDim text-[11px] font-semibold uppercase tracking-[0.4px]">Saved</div>
                          <div className="text-accentGreen text-[17px] font-extrabold mt-[3px]">{m.usage.savedPct}%</div>
                        </div>
                        <div>
                          <div className="text-textDim text-[11px] font-semibold uppercase tracking-[0.4px]">Model used</div>
                          <div className="text-textTertiary text-sm font-semibold mt-[5px]">{m.usage.model}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-[13px] border-t border-borderCard">
                        <span className="text-textDim text-[12.5px] font-semibold">Tag for ROI:</span>
                        {tagOptions.map((t) => (
                          <div
                            key={t}
                            onClick={() => active && setRoiTag(active.id, m.id, t)}
                            className="text-[12.5px] font-semibold px-[11px] py-[5px] rounded-[7px] cursor-pointer border"
                            style={{
                              background: m.roiTag === t ? 'rgba(91,141,255,.18)' : 'rgba(255,255,255,.04)',
                              color: m.roiTag === t ? '#7aa5ff' : '#aab2c2',
                              borderColor: m.roiTag === t ? 'rgba(91,141,255,.5)' : 'rgba(255,255,255,.08)',
                            }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          {/* Smart Composer */}
          <div className="p-[16px_26px_22px] border-t border-borderSubtle max-md:p-[10px_10px_14px]">
            <div className="bg-card border border-[rgba(91,141,255,.28)] rounded-2xl p-[14px_16px] shadow-composer">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-textDim text-xs font-semibold max-md:hidden">Will apply:</span>
                {chips.map((c) => (
                  <div
                    key={c.label}
                    onClick={() => c.set(!c.on)}
                    className="flex items-center gap-[6px] text-[12.5px] font-semibold px-[11px] py-1 rounded-[7px] cursor-pointer border"
                    style={{
                      background: c.on ? 'rgba(43,182,115,.14)' : 'rgba(255,255,255,.04)',
                      color: c.on ? '#5fd08a' : '#7b8398',
                      borderColor: c.on ? 'rgba(43,182,115,.4)' : 'rgba(255,255,255,.08)',
                    }}
                  >
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: c.on ? c.dot : '#5b6478' }} />
                    {c.on ? c.label : c.label + ' (off)'}
                  </div>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={2}
                placeholder="Ask anything — TokenStream picks the cheapest model that can do the job…"
                className="w-full resize-none bg-transparent border-none outline-none text-textSecondary text-[15px] leading-[1.5] p-[2px_0]"
              />
              <div className="flex items-center justify-between mt-3 gap-4 flex-wrap">
                <div className="flex items-center gap-[18px] flex-wrap max-md:gap-3">
                  <div>
                    <div className="text-textMuted text-[11.5px] font-semibold uppercase tracking-[0.4px]">Est. cost</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-[22px] font-extrabold tracking-[-0.5px] max-md:text-[17px]">{fmtMoney(calc.optCost)}</span>
                      <span className="text-textDisabled text-[13px] font-medium line-through">{fmtMoney(calc.baseCost)}</span>
                      <span className="text-accentGreen text-[13px] font-bold">{calc.savingsPct}% cheaper</span>
                    </div>
                  </div>
                  <div className="w-px h-[34px] bg-[rgba(255,255,255,.08)] max-md:hidden" />
                  <div className="max-md:hidden">
                    <div className="text-textMuted text-[11.5px] font-semibold uppercase tracking-[0.4px]">Tokens</div>
                    <div className="text-textTertiary text-[15px] font-bold mt-[3px]">≈ {calc.totalTokens.toLocaleString()} tok</div>
                  </div>
                  <div className="max-md:w-full">
                    <div className="text-textMuted text-[11.5px] font-semibold uppercase tracking-[0.4px] max-md:hidden">Model</div>
                    <div className="flex items-center gap-[6px] mt-[3px] max-md:mt-0">
                      <select
                        value={pinnedName ?? ''}
                        onChange={(e) => active && setConversationModel(active.id, e.target.value || null)}
                        className="bg-input border border-borderInput rounded-[7px] px-[8px] py-[4px] text-textTertiary text-[13.5px] font-bold outline-none cursor-pointer focus:border-[rgba(91,141,255,.5)] max-w-[210px] max-md:max-w-none max-md:flex-1 max-md:py-[7px]"
                      >
                        <option value="">Auto — cheapest ({bestFreeModel().name} · $0.00)</option>
                        {modelEstimates.map(({ model, cost }) => (
                          <option key={model.name} value={model.name}>
                            {model.name} · {fmtMoney(cost)}
                            {model.free ? ' (free)' : ''}
                          </option>
                        ))}
                      </select>
                      {FREE_MODEL_NAMES.has(calc.routeModelName) && (
                        <span className="bg-[rgba(43,182,115,.16)] text-accentGreen text-[10.5px] font-bold px-[6px] py-[1px] rounded-[5px]">
                          Free
                        </span>
                      )}
                    </div>
                    {recommendation && (
                      <button
                        onClick={() => active && setConversationModel(active.id, recommendation.model.name)}
                        className="text-accentGreen text-[11px] font-semibold mt-[3px] cursor-pointer hover:underline text-left"
                      >
                        💡 {recommendation.model.name} would cost {fmtMoney(recommendation.savings)} less
                        {recommendation.model.free ? ' — and it’s free' : ''} · switch
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-[10px] max-md:w-full">
                  <button
                    onClick={() => {
                      if (!active || !text.trim()) return
                      sendMessage(active.id, text.trim(), { compress: false, route: false, cache: false })
                      setText('')
                    }}
                    className="text-[#aab2c2] text-sm font-semibold p-[11px_16px] rounded-[10px] border border-borderInput cursor-pointer"
                  >
                    Send as-is
                  </button>
                  <button
                    onClick={send}
                    className="flex items-center justify-center gap-[9px] bg-primary-gradient text-white text-[14.5px] font-bold p-[11px_20px] rounded-[10px] cursor-pointer max-md:flex-1"
                  >
                    <span className="max-md:hidden">Send with optimization</span>
                    <span className="md:hidden">Send optimized</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8h11M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Optimization Breakdown panel — inline on desktop, slide-over on phones */}
        {panelOpen && <div className="md:hidden fixed inset-0 z-[59] bg-black/60" onClick={() => setPanelOpen(false)} />}
        {panelOpen && (
          <div className="flex-none w-[320px] border-l border-borderSubtle flex flex-col min-h-0 bg-[#0e131c] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-[60] max-md:w-[300px] max-md:shadow-shell">
            <div className="flex items-center justify-between p-[18px_22px] border-b border-borderSubtle">
              <span className="text-white text-[15.5px] font-bold">Optimization Breakdown</span>
              <div
                onClick={() => setPanelOpen(false)}
                className="cursor-pointer w-[26px] h-[26px] rounded-[7px] flex items-center justify-center hover:bg-[rgba(255,255,255,.06)]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="#8b93a5" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-[20px_22px] flex flex-col gap-[22px]">
              <div className="text-textDim text-[13px] font-medium leading-[1.5]">
                What TokenStream will do to your next message:
              </div>

              <div>
                <div className="flex items-center gap-[9px] mb-[9px]">
                  <span className="w-[9px] h-[9px] rounded-full bg-accentGreenMid" />
                  <span className="text-textTertiary text-[13.5px] font-bold">Prompt Compression</span>
                </div>
                <div className="text-white text-xl font-extrabold">
                  {compress ? `Saved ${calc.savedTokens.toLocaleString()} tokens` : 'Compression off'}
                </div>
                <div className="mt-[10px] h-[7px] bg-[#1d2532] rounded-[99px] overflow-hidden">
                  <div className="h-full bg-accentGreenMid rounded-[99px]" style={{ width: `${Math.round((calc.savedTokens / 1200) * 100)}%` }} />
                </div>
              </div>

              <div className="h-px bg-borderCard" />

              <div>
                <div className="flex items-center gap-[9px] mb-[9px]">
                  <span className="w-[9px] h-[9px] rounded-full bg-[#5b8dff]" />
                  <span className="text-textTertiary text-[13.5px] font-bold">Model Selected</span>
                </div>
                <div className="text-white text-xl font-extrabold">{calc.routeModelName}</div>
                <div className="text-textMuted text-[13px] font-medium mt-[5px] leading-[1.45]">
                  {route ? 'Cheapest model that clears the quality bar for this task.' : 'Manually pinned to GPT-4o — routing is off.'}
                </div>
              </div>

              <div className="h-px bg-borderCard" />

              <div>
                <div className="flex items-center gap-[9px] mb-3">
                  <span className="w-[9px] h-[9px] rounded-full bg-accentPurple" />
                  <span className="text-textTertiary text-[13.5px] font-bold">Estimated Cost vs Standard</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-textMuted text-[13.5px] font-medium">Optimized</span>
                  <span className="text-white text-[15px] font-bold">{fmtMoney(calc.optCost)}</span>
                </div>
                <div className="flex items-center justify-between mb-[14px]">
                  <span className="text-textMuted text-[13.5px] font-medium">Standard (GPT-4o)</span>
                  <span className="text-textDisabled text-[15px] font-semibold line-through">{fmtMoney(calc.baseCost)}</span>
                </div>
                <div className="bg-[rgba(43,182,115,.14)] border border-[rgba(43,182,115,.32)] rounded-[9px] p-[11px_14px] text-center">
                  <span className="text-accentGreen text-[14.5px] font-extrabold">
                    You save {fmtMoney(calc.baseCost - calc.optCost)} on this query
                  </span>
                </div>
              </div>
            </div>
            <div className="p-[16px_22px] border-t border-borderSubtle flex flex-col gap-[9px]">
              <div className="flex gap-[9px]">
                <div className="flex-1 text-center text-textTertiary text-[13px] font-semibold p-[9px] rounded-lg border border-borderInput cursor-pointer">Tag as Tax</div>
                <div className="flex-1 text-center text-textTertiary text-[13px] font-semibold p-[9px] rounded-lg border border-borderInput cursor-pointer">View full trace</div>
              </div>
              <div className="text-center bg-primary-gradient text-white text-[13.5px] font-bold p-[10px] rounded-lg cursor-pointer">Add to ROI tracking</div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
