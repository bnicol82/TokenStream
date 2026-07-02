import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import ProvidersModal from '../components/ProvidersModal'
import EmptyState from '../components/EmptyState'
import { useApp } from '../lib/app-context'
import { fmtMoney, combinedModels } from '../lib/models'
import { filterByDays } from '../lib/selectors'
import type { TaskTag } from '../lib/types'

const providerCatalog = [
  { name: 'OpenAI', initial: 'O', color: '#10a37f' },
  { name: 'Anthropic', initial: 'A', color: '#d97757' },
  { name: 'Grok', initial: 'G', color: '#1d9bf0' },
  { name: 'Together AI', initial: 'T', color: '#0f6fff' },
  { name: 'Mistral', initial: 'M', color: '#ff7000' },
  { name: 'Gemini', initial: 'G', color: '#4285f4' },
  { name: 'Cohere', initial: 'C', color: '#9b6bff' },
  { name: 'Groq', initial: 'G', color: '#f55036' },
  { name: 'OpenRouter', initial: 'O', color: '#6566f1' },
]

// --- Line chart geometry (illustrative trend) ------------------------------
const lineYTicks = [60, 40, 20, 0]
const lineGrid = lineYTicks.map((t) => {
  const y = 28 + ((60 - t) / 60) * (140 - 28)
  return { y, ty: y + 4, label: t ? t + 'k' : '0' }
})
const lineMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
const lineX = lineMonths.map((m, i) => ({ x: 40 + ((510 - 40) * i) / (lineMonths.length - 1), label: m }))

const rangeDays: Record<string, number> = { 'Last 7 days': 7, 'Last 30 days': 30, Custom: 3650 }
const allTags: TaskTag[] = ['Tax', 'Research', 'Code', 'General', 'Triage', 'Writing']
const emptyLogForm = { modelName: '', tag: 'General' as TaskTag, projectId: '', inputTokens: '', outputTokens: '', cost: '', optimized: true }

// Shared grid template for the transaction table (header + rows must match).
const txGrid = 'grid grid-cols-[1fr_1fr_1fr_.9fr_1fr_.8fr_.8fr_.7fr_.8fr_.7fr] gap-2'

const fmtDate = (ts: number) => {
  const d = new Date(ts)
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mon} ${d.getDate()}, ${hh}:${mm}`
}

export default function SpendTracking() {
  const { data, logTransaction } = useApp()
  const navigate = useNavigate()
  const [activeRange, setActiveRange] = useState('Custom')
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('') // '' = all, 'none' = Unassigned, else project id
  const [logOpen, setLogOpen] = useState(false)
  const [logForm, setLogForm] = useState(emptyLogForm)
  const [providersOpen, setProvidersOpen] = useState(false)
  // Filters sidebar is always visible on desktop; collapsible on small screens.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const projectName = useMemo(() => {
    const m = new Map(data.projects.map((p) => [p.id, p]))
    return (id: string | null | undefined) => (id ? m.get(id) : undefined)
  }, [data.projects])

  const connectedProviders = useMemo(
    () => new Map(data.providerConnections.map((c) => [c.provider, c])),
    [data.providerConnections],
  )

  const models = useMemo(() => [...new Set(data.transactions.map((t) => t.model))], [data.transactions])
  const tags = useMemo(() => [...new Set(data.transactions.map((t) => t.tag))], [data.transactions])
  const catalog = useMemo(() => combinedModels(data.customModels), [data.customModels])

  const submitLog = () => {
    const model = catalog.find((m) => m.name === logForm.modelName)
    const inputTokens = parseInt(logForm.inputTokens, 10) || 0
    const outputTokens = parseInt(logForm.outputTokens, 10) || 0
    if (!model || (inputTokens === 0 && outputTokens === 0)) return
    const baseCost = (inputTokens * 5 + outputTokens * 15) / 1e6 // vs. frontier GPT-4o pricing
    const cost = logForm.cost.trim() ? parseFloat(logForm.cost) : (inputTokens * model.priceIn + outputTokens * model.priceOut) / 1e6
    logTransaction({
      ts: Date.now(),
      provider: model.provider,
      model: model.name,
      tag: logForm.tag,
      inputTokens,
      outputTokens,
      cost,
      baseCost: Math.max(baseCost, cost),
      optimized: logForm.optimized,
      projectId: logForm.projectId || data.activeProjectId || null,
    })
    setLogForm(emptyLogForm)
    setLogOpen(false)
  }

  const filtered = useMemo(() => {
    let txns = filterByDays(data.transactions, rangeDays[activeRange] ?? 3650)
    if (providerFilter) txns = txns.filter((t) => t.provider === providerFilter)
    if (modelFilter) txns = txns.filter((t) => t.model === modelFilter)
    if (tagFilter) txns = txns.filter((t) => t.tag === tagFilter)
    if (projectFilter) txns = txns.filter((t) => (projectFilter === 'none' ? !t.projectId : t.projectId === projectFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      txns = txns.filter(
        (t) =>
          t.provider.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q) ||
          t.tag.toLowerCase().includes(q),
      )
    }
    return txns.sort((a, b) => b.ts - a.ts)
  }, [data.transactions, activeRange, providerFilter, modelFilter, tagFilter, projectFilter, search])

  const providerCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of data.transactions) map.set(t.provider, (map.get(t.provider) ?? 0) + 1)
    return map
  }, [data.transactions])

  const exportCsv = () => {
    const header = ['Date', 'Provider', 'Model', 'Task Tag', 'Project', 'Input', 'Output', 'Cost', 'Optimized', 'Savings']
    const rows = filtered.map((t) => {
      const sav = t.optimized && t.baseCost > 0 ? Math.round((1 - t.cost / t.baseCost) * 100) + '%' : '—'
      return [fmtDate(t.ts), t.provider, t.model, t.tag, projectName(t.projectId)?.name ?? 'Unassigned', t.inputTokens, t.outputTokens, fmtMoney(t.cost), t.optimized ? 'Yes' : 'No', sav]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tokenstream-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Bar chart "Spend by Provider" derived from filtered transactions
  const barData = useMemo(() => {
    const top = ['OpenAI', 'Anthropic']
    const groups = [...new Set(filtered.map((t) => fmtDate(t.ts).split(',')[0]))].slice(-8)
    const colors = ['#5b8dff', '#3ec98a', '#8bb4ff']
    const bx0 = 44, bx1 = 512, byTop = 14, byBot = 156
    const plotH = byBot - byTop
    const clusterW = (bx1 - bx0) / Math.max(groups.length, 1)
    const barW = 9, gap = 3, groupW = barW * 3 + gap * 2
    let maxV = 1
    const series = groups.map((g) => {
      const inGroup = filtered.filter((t) => fmtDate(t.ts).split(',')[0] === g)
      const o = inGroup.filter((t) => t.provider === 'OpenAI').reduce((s, t) => s + t.cost, 0)
      const a = inGroup.filter((t) => t.provider === 'Anthropic').reduce((s, t) => s + t.cost, 0)
      const other = inGroup.filter((t) => !top.includes(t.provider)).reduce((s, t) => s + t.cost, 0)
      maxV = Math.max(maxV, o, a, other)
      return { g, vals: [o, a, other] }
    })
    const rects: { x: number; y: number; w: number; h: number; fill: string }[] = []
    series.forEach((s, ci) => {
      const cx = bx0 + clusterW * ci + (clusterW - groupW) / 2
      s.vals.forEach((v, bi) => {
        const h = (v / maxV) * plotH
        rects.push({ x: cx + bi * (barW + gap), y: byBot - h, w: barW, h, fill: colors[bi] })
      })
    })
    const labelsX = series.map((s, ci) => ({ x: bx0 + clusterW * ci + clusterW / 2, label: s.g.replace(/^[A-Za-z]+ /, '') }))
    return { rects, labelsX }
  }, [filtered])

  const legend = [
    { name: 'OpenAI', color: '#5b8dff' },
    { name: 'Anthropic', color: '#3ec98a' },
    { name: 'Others', color: '#8bb4ff' },
  ]

  const selectCls =
    'text-[#aab2c2] text-[14.5px] font-medium p-[10px_13px] border border-borderInput rounded-[9px] mb-2 w-full bg-input outline-none cursor-pointer focus:border-[rgba(91,141,255,.5)]'

  return (
    <Shell>
      <div className="grid grid-cols-[212px_1fr] max-lg:grid-cols-1">
        <div className="border-r border-borderSubtle p-[24px_18px] max-lg:border-r-0 max-lg:border-b max-lg:p-4">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="hidden max-lg:flex w-full items-center justify-between text-textTertiary text-[14px] font-bold cursor-pointer"
          >
            Filters &amp; Providers
            <svg width="12" height="12" viewBox="0 0 11 11" fill="none" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none' }}>
              <path d="M2 4L5.5 7.5L9 4" stroke="#8b93a5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={filtersOpen ? 'max-lg:mt-4' : 'max-lg:hidden'}>
          <div className="text-textMuted text-[13px] font-bold tracking-[0.6px] uppercase mb-3">Filters</div>
          <div className="bg-primary-gradient text-white text-[14.5px] font-semibold p-[10px_13px] rounded-[9px] mb-2 flex items-center gap-[9px]">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="2.5" width="12" height="11" rx="2" stroke="#fff" strokeWidth="1.4" />
              <path d="M1.5 5.5h12M4.5 1v3M10.5 1v3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Date Range
          </div>
          <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className={selectCls}>
            <option value="">All Providers</option>
            {providerCatalog.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className={selectCls}>
            <option value="">All Models</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectCls}>
            <option value="">All Task Tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectCls}>
            <option value="">All Projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="none">Unassigned</option>
          </select>

          <div className="flex items-center justify-between mt-7 mb-[14px]">
            <span className="text-textMuted text-[13px] font-bold tracking-[0.6px] uppercase">Connected Providers</span>
            <button onClick={() => setProvidersOpen(true)} className="text-[#7aa5ff] text-[12px] font-semibold cursor-pointer">
              Manage
            </button>
          </div>
          {providerCatalog.map((p) => {
            const conn = connectedProviders.get(p.name)
            return (
              <div
                key={p.name}
                onClick={() => setProviderFilter(providerFilter === p.name ? '' : p.name)}
                className="flex items-center justify-between p-[8px_4px] cursor-pointer rounded-[6px] hover:bg-[rgba(255,255,255,.03)]"
              >
                <div className="flex items-center gap-[10px]">
                  <div className="relative w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-white text-[11px] font-extrabold" style={{ background: p.color }}>
                    {p.initial}
                    {conn && (
                      <span
                        className="absolute -top-[3px] -right-[3px] w-[9px] h-[9px] rounded-full border-2 border-app"
                        style={{ background: conn.status === 'error' ? '#f0915a' : '#3ec98a' }}
                        title={conn.status === 'error' ? 'Sync error' : `Connected (${conn.mode})`}
                      />
                    )}
                  </div>
                  <span className="text-textTertiary text-[14.5px] font-medium" style={{ color: providerFilter === p.name ? '#fff' : undefined }}>
                    {p.name}
                  </span>
                </div>
                <span className="bg-[#1d2532] text-textMuted text-xs font-semibold min-w-[20px] text-center px-[6px] py-[2px] rounded-[6px]">
                  {providerCounts.get(p.name) ?? 0}
                </span>
              </div>
            )
          })}
          </div>
        </div>

        <div className="p-[24px_28px] pb-[30px] max-md:p-4 max-md:pb-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <span className="text-white text-[28px] font-extrabold tracking-[-0.5px] max-md:text-[24px]">Spend Tracking</span>
            <div className="flex items-center gap-[10px]">
              <div className="text-[#aab2c2] text-[14.5px] font-semibold px-4 py-[9px] rounded-[9px] border border-borderInput cursor-pointer">Compare</div>
              <button
                onClick={() => {
                  setLogForm({ ...emptyLogForm, projectId: data.activeProjectId ?? '' })
                  setLogOpen(true)
                }}
                className="bg-primary-gradient text-white text-[14.5px] font-semibold px-[18px] py-[9px] rounded-[9px] cursor-pointer"
              >
                + Log Usage
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex gap-2 bg-card p-[5px] rounded-[11px] border border-borderSubtle max-md:w-full max-md:justify-between max-md:gap-1">
              {['Last 7 days', 'Last 30 days', 'Custom'].map((r) => (
                <div
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className="text-sm px-4 py-2 rounded-[8px] cursor-pointer"
                  style={{
                    background: activeRange === r ? 'linear-gradient(90deg,#174dcc,#3770f0)' : 'transparent',
                    color: activeRange === r ? '#fff' : '#aab2c2',
                    fontWeight: activeRange === r ? 600 : 500,
                  }}
                >
                  {r === 'Custom' ? 'All time' : r}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-textTertiary text-[15px] font-semibold">{filtered.length} transactions</span>
            </div>
          </div>

          {data.transactions.length === 0 && (
            <div className="mb-5">
              <EmptyState
                emoji="📈"
                title="No usage tracked yet"
                body="Send a chat or log a call you made elsewhere — TokenStream records the cost, model, and savings, then charts it here."
                ctaLabel="Start a chat"
                onCta={() => navigate('/chat')}
                secondaryLabel="+ Log Usage"
                onSecondary={() => {
                  setLogForm({ ...emptyLogForm, projectId: data.activeProjectId ?? '' })
                  setLogOpen(true)
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-[18px] mb-5 max-lg:grid-cols-1">
            <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-textSecondary text-[16.5px] font-bold">Daily Token Spend Trend</span>
                <div className="flex items-center gap-[7px] bg-navActive text-textTertiary text-[13px] font-semibold px-3 py-[6px] rounded-[8px] cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-[#5b8dff]" />
                  Tokens
                </div>
              </div>
              <svg viewBox="0 0 520 186" fill="none" className="w-full h-auto">
                <defs>
                  <linearGradient id="st-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5b8dff" stopOpacity=".34" />
                    <stop offset="1" stopColor="#5b8dff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {lineGrid.map((g, i) => (
                  <g key={i}>
                    <line x1="40" y1={g.y} x2="510" y2={g.y} stroke="rgba(255,255,255,.06)" strokeWidth="1" strokeDasharray="4 5" />
                    <text x="32" y={g.ty} fill="#6c7488" fontSize="11" fontFamily="Inter" textAnchor="end">{g.label}</text>
                  </g>
                ))}
                <path d="M40 130 C75 122 90 92 120 96 C150 100 160 70 195 66 C228 62 240 104 275 102 C312 100 322 60 360 52 C398 44 408 78 445 70 C478 63 492 36 510 28 L510 168 L40 168 Z" fill="url(#st-area)" />
                <path d="M40 130 C75 122 90 92 120 96 C150 100 160 70 195 66 C228 62 240 104 275 102 C312 100 322 60 360 52 C398 44 408 78 445 70 C478 63 492 36 510 28" stroke="#6a9bff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
                <circle cx="360" cy="52" r="5" fill="#0c1016" stroke="#6a9bff" strokeWidth="3" />
                {lineX.map((x, i) => (
                  <text key={i} x={x.x} y="182" fill="#6c7488" fontSize="11" fontFamily="Inter" textAnchor="middle">{x.label}</text>
                ))}
              </svg>
            </div>

            <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-textSecondary text-[16.5px] font-bold">Spend by Provider</span>
                <div className="flex items-center gap-[14px]">
                  {legend.map((l) => (
                    <div key={l.name} className="flex items-center gap-[6px]">
                      <span className="w-[9px] h-[9px] rounded-[2px]" style={{ background: l.color }} />
                      <span className="text-textMuted text-xs font-medium">{l.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 520 186" fill="none" className="w-full h-auto">
                {[0, 39, 78, 117, 156].map((y, i) => (
                  <line key={i} x1="44" y1={y + 14} x2="512" y2={y + 14} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
                ))}
                {barData.rects.map((b, i) => (
                  <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={b.fill} />
                ))}
                {barData.labelsX.map((x, i) => (
                  <text key={i} x={x.x} y="182" fill="#6c7488" fontSize="11" fontFamily="Inter" textAnchor="middle">{x.label}</text>
                ))}
              </svg>
            </div>
          </div>

          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px] max-md:p-[14px_12px]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-[9px] bg-navActive text-textTertiary text-sm font-semibold px-[15px] py-[9px] rounded-[9px]">
                Show: {filtered.length} of {data.transactions.length}
              </div>
              <div className="flex items-center gap-[10px] max-md:w-full">
                <div className="flex items-center gap-[9px] bg-input border border-borderInput px-[14px] py-[9px] rounded-[9px] w-[230px] max-md:flex-1 max-md:w-auto">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="6.5" cy="6.5" r="5" stroke="#6c7488" strokeWidth="1.5" />
                    <path d="M10 10L13.5 13.5" stroke="#6c7488" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search transactions…"
                    className="bg-transparent border-none outline-none text-textSecondary text-sm w-full placeholder:text-textDisabled"
                  />
                </div>
                <button onClick={exportCsv} className="flex items-center gap-2 bg-primary-gradient text-white text-sm font-semibold px-4 py-[9px] rounded-[9px] cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5V9M7 9L4 6M7 9L10 6M2 11.5h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="text-textMuted text-sm text-center py-10">No transactions match your filters.</div>
            )}

            {/* Phone layout: one card per transaction (no sideways scrolling) */}
            <div className="md:hidden">
              {filtered.map((t) => {
                const sav = t.optimized && t.baseCost > 0 ? Math.round((1 - t.cost / t.baseCost) * 100) + '%' : null
                const proj = projectName(t.projectId)
                return (
                  <div key={t.id} className="flex items-start justify-between gap-3 py-[12px] border-b border-[rgba(255,255,255,.05)]">
                    <div className="min-w-0">
                      <div className="text-[#d6dbe6] text-[15px] font-semibold truncate">{t.model}</div>
                      <div className="text-textMuted text-[12.5px] font-medium mt-[2px]">
                        {fmtDate(t.ts)} · {t.provider}
                      </div>
                      <div className="flex items-center gap-[6px] mt-[7px] flex-wrap">
                        <span className="bg-[#1d2532] text-[#bcc4d2] text-[11.5px] font-semibold px-[7px] py-[2px] rounded-[6px]">{t.tag}</span>
                        {proj && (
                          <span className="inline-flex items-center gap-[5px] text-[#bcc4d2] text-[11.5px] font-medium">
                            <span className="w-[7px] h-[7px] rounded-[2px] flex-none" style={{ background: proj.color }} />
                            {proj.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-none">
                      <div className="text-white text-[15px] font-bold">{fmtMoney(t.cost)}</div>
                      <div className="text-textMuted text-[12px] font-medium mt-[2px]">
                        {(t.inputTokens + t.outputTokens).toLocaleString()} tok
                      </div>
                      {sav ? (
                        <div className="text-accentGreen text-[12px] font-bold mt-[2px]">saved {sav}</div>
                      ) : (
                        <div className="text-textDim text-[12px] font-medium mt-[2px]">not optimized</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="max-lg:overflow-x-auto max-md:hidden">
            <div className="max-lg:min-w-[900px]">
            <div className={`${txGrid} pb-3 px-[6px] border-b border-[rgba(255,255,255,.07)]`}>
              {['Date', 'Provider', 'Model', 'Task Tag', 'Project', 'Input', 'Output', 'Cost', 'Optimized', 'Savings'].map((h) => (
                <span key={h} className="text-textMuted text-[13.5px] font-semibold">{h}</span>
              ))}
            </div>

            {filtered.map((t) => {
              const sav = t.optimized && t.baseCost > 0 ? Math.round((1 - t.cost / t.baseCost) * 100) + '%' : '—'
              const proj = projectName(t.projectId)
              return (
                <div key={t.id} className={`${txGrid} items-center py-3 px-[6px] border-b border-[rgba(255,255,255,.04)]`}>
                  <span className="text-[#aab2c2] text-sm font-medium">{fmtDate(t.ts)}</span>
                  <span className="text-[#d6dbe6] text-sm font-medium">{t.provider}</span>
                  <span className="text-[#d6dbe6] text-sm font-medium">{t.model}</span>
                  <div>
                    <span className="bg-[#1d2532] text-[#bcc4d2] text-[12.5px] font-semibold px-[9px] py-[3px] rounded-[6px]">{t.tag}</span>
                  </div>
                  <div className="min-w-0">
                    {proj ? (
                      <span className="inline-flex items-center gap-[5px] text-[#bcc4d2] text-[12.5px] font-medium truncate">
                        <span className="w-[8px] h-[8px] rounded-[2px] flex-none" style={{ background: proj.color }} />
                        {proj.name}
                      </span>
                    ) : (
                      <span className="text-textDim text-[12.5px]">—</span>
                    )}
                  </div>
                  <span className="text-[#aab2c2] text-sm">{t.inputTokens.toLocaleString()}</span>
                  <span className="text-[#aab2c2] text-sm">{t.outputTokens.toLocaleString()}</span>
                  <span className="text-[#d6dbe6] text-sm font-semibold">{fmtMoney(t.cost)}</span>
                  <div>
                    {t.optimized ? (
                      <span className="bg-[rgba(43,182,115,.16)] text-accentGreen text-[12.5px] font-bold px-3 py-1 rounded-[7px]">Yes</span>
                    ) : (
                      <span className="bg-[rgba(255,255,255,.06)] text-textMuted text-[12.5px] font-bold px-3 py-1 rounded-[7px]">No</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: t.optimized ? '#5fd08a' : '#6c7488' }}>{sav}</span>
                </div>
              )
            })}
            </div>
            </div>
          </div>
        </div>
      </div>

      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLogOpen(false)}
        >
          <div
            className="w-full max-w-[400px] bg-card border border-borderCard rounded-[16px] p-[26px] shadow-shell"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white text-[20px] font-bold mb-1">Log Usage</div>
            <div className="text-textMuted text-[13.5px] mb-5">Record a real AI call you made outside TokenStream.</div>

            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Model</label>
            <select
              value={logForm.modelName}
              onChange={(e) => setLogForm((f) => ({ ...f, modelName: e.target.value }))}
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-3 cursor-pointer"
            >
              <option value="">Select a model…</option>
              {catalog.map((m) => (
                <option key={m.name} value={m.name}>{m.name} · {m.provider}</option>
              ))}
            </select>

            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Task Tag</label>
            <select
              value={logForm.tag}
              onChange={(e) => setLogForm((f) => ({ ...f, tag: e.target.value as TaskTag }))}
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-3 cursor-pointer"
            >
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Project</label>
            <select
              value={logForm.projectId}
              onChange={(e) => setLogForm((f) => ({ ...f, projectId: e.target.value }))}
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-3 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Input Tokens</label>
                <input
                  value={logForm.inputTokens}
                  onChange={(e) => setLogForm((f) => ({ ...f, inputTokens: e.target.value }))}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)]"
                />
              </div>
              <div>
                <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Output Tokens</label>
                <input
                  value={logForm.outputTokens}
                  onChange={(e) => setLogForm((f) => ({ ...f, outputTokens: e.target.value }))}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)]"
                />
              </div>
            </div>

            <label className="block text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-1">Cost (optional — auto-calculated if blank)</label>
            <input
              value={logForm.cost}
              onChange={(e) => setLogForm((f) => ({ ...f, cost: e.target.value }))}
              inputMode="decimal"
              placeholder="$0.00"
              className="w-full bg-input border border-borderInput rounded-[9px] px-3 py-[10px] text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] mb-4"
            />

            <div
              onClick={() => setLogForm((f) => ({ ...f, optimized: !f.optimized }))}
              className="flex items-center justify-between mb-5 cursor-pointer"
            >
              <span className="text-textTertiary text-sm font-medium">Mark as optimized</span>
              <input type="checkbox" checked={logForm.optimized} readOnly className="w-4 h-4 cursor-pointer" />
            </div>

            <button
              onClick={submitLog}
              disabled={!logForm.modelName || (!logForm.inputTokens && !logForm.outputTokens)}
              className="w-full bg-primary-gradient text-white text-sm font-bold py-[11px] rounded-[10px] shadow-btnGlow disabled:opacity-50"
            >
              Save Transaction
            </button>
          </div>
        </div>
      )}

      <ProvidersModal open={providersOpen} onClose={() => setProvidersOpen(false)} />
    </Shell>
  )
}
