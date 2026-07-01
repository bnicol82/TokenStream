import { useState } from 'react'
import Shell from '../components/Shell'
import { useApp } from '../lib/app-context'
import type { Budget } from '../lib/types'
import { fmtTokens, budgetUsage } from '../lib/selectors'
import { fmtMoney } from '../lib/models'
import EmptyState from '../components/EmptyState'

const categoryStyle = {
  personal: { color: '#5b8dff', iconBg: 'rgba(91,141,255,.14)', barFill: 'linear-gradient(90deg,#3f6fe0,#6a9bff)' },
  tax: { color: '#3ec98a', iconBg: 'rgba(62,201,138,.14)', barFill: 'linear-gradient(90deg,#2bb673,#3ec98a)' },
  team: { color: '#f0915a', iconBg: 'rgba(240,145,90,.14)', barFill: 'linear-gradient(90deg,#e07b3f,#f0915a)' },
} as const

function statusFor(pct: number, threshold: number) {
  if (pct >= threshold) return { label: 'Near limit', tagBg: 'rgba(240,145,90,.16)', tagColor: '#f0a878' }
  if (pct >= 60) return { label: 'On track', tagBg: 'rgba(43,182,115,.16)', tagColor: '#5fd08a' }
  return { label: 'Healthy', tagBg: 'rgba(43,182,115,.16)', tagColor: '#5fd08a' }
}

// --- Budget history chart geometry (illustrative trend) --------------------
const labels = ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Wk6']
const cur = [4, 9, 16, 19, 14, 8]
const prev = [5, 8, 12, 13, 10, 6]
const x0 = 36,
  x1 = 332,
  yTop = 14,
  yBot = 196,
  maxV = 22
const X = (i: number) => x0 + ((x1 - x0) * i) / (labels.length - 1)
const Y = (v: number) => yBot - (v / maxV) * (yBot - yTop)
function curve(pts: { x: number; y: number }[]) {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`
  return d
}
function line(arr: number[]) {
  const p = arr.map((v, i) => ({ x: X(i), y: Y(v) }))
  return `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}` + curve(p)
}
const histCur = line(cur)
const histPrev = line(prev)
const histCurArea = histCur + ` L ${X(labels.length - 1).toFixed(1)} ${yBot} L ${x0.toFixed(1)} ${yBot} Z`
const histTicks = [20, 15, 10, 5, 0]
const histGrid = histTicks.map((t) => {
  const y = Y(t)
  return { y, ty: y + 4, label: t ? '$' + (t / 10).toFixed(1) + 'k' : '$0' }
})
const histX = labels.map((l, i) => ({ x: X(i), label: l }))

export default function Budgets() {
  const { data, addBudget, deleteBudget, setAlerts } = useApp()
  const { budgets, alerts, projects, transactions } = data
  const { threshold, channels } = alerts
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', limit: '', category: 'personal' as Budget['category'], projectId: '' })

  // Live usage per budget (scoped to its project, or all usage).
  const usageOf = (b: Budget) => budgetUsage(transactions, b)
  const projectName = (id: string | null | undefined) => (id ? projects.find((p) => p.id === id)?.name : null)

  // Forecasting from the primary (first) budget, using live spend.
  const primary = budgets[0]
  const primarySpent = primary ? usageOf(primary).spent : 0
  const projected = Math.round(primarySpent * 1.52)
  const spare = primary ? primary.limit - projected : 0
  const onTrack = spare >= 0

  const submit = () => {
    const limit = parseFloat(form.limit)
    if (!form.name.trim() || !limit || limit <= 0) return
    addBudget({
      name: form.name.trim(),
      category: form.category,
      limit,
      spent: 0,
      tokenUsed: 0,
      tokenCap: Math.round(limit * 40),
      projectId: form.projectId || null,
    })
    setForm({ name: '', limit: '', category: 'personal', projectId: '' })
    setShowForm(false)
  }

  return (
    <Shell>
      <div className="px-[30px] py-[26px] pb-[30px]">
        <div className="flex items-start justify-between mb-[22px]">
          <div>
            <div className="text-white text-[28px] font-extrabold tracking-[-0.5px]">
              Budget Management
            </div>
            <div className="text-textMuted text-[15px] font-medium mt-[5px]">
              Set multiple budgets, forecast spend, and configure smart alerts.
            </div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="flex items-center gap-2 text-[#aab2c2] text-sm font-semibold px-[15px] py-[9px] rounded-[9px] border border-borderInput cursor-pointer">
              April 2026
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 4L5.5 7.5L9 4" stroke="#8b93a5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-2 bg-primary-gradient text-white text-sm font-semibold px-[18px] py-[9px] rounded-[9px] cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              New Budget
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-card border border-borderCard rounded-[14px] p-[18px_22px] mb-[18px] flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Marketing"
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] w-[220px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Limit ($)</label>
              <input
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
                placeholder="1000"
                inputMode="decimal"
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] w-[120px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Budget['category'] })}
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)]"
              >
                <option value="personal">Personal</option>
                <option value="tax">Tax / Project</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Scope</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)]"
              >
                <option value="">All usage</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button onClick={submit} className="bg-primary-gradient text-white text-sm font-semibold px-[18px] py-2 rounded-[9px]">
              Add
            </button>
            <button onClick={() => setShowForm(false)} className="text-[#aab2c2] text-sm font-semibold px-3 py-2 rounded-[9px] border border-borderInput">
              Cancel
            </button>
          </div>
        )}

        {budgets.length === 0 && !showForm && (
          <div className="mb-[18px]">
            <EmptyState
              emoji="🎯"
              title="Set your first budget"
              body="Create a budget for your overall AI spend or scope it to a specific project. We'll track usage live and alert you before you cross your threshold."
              ctaLabel="New Budget"
              onCta={() => setShowForm(true)}
            />
          </div>
        )}

        <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-[18px] mb-[18px]">
          {budgets.slice(0, 3).map((b) => {
            const cs = categoryStyle[b.category]
            const u = usageOf(b)
            const pct = Math.round((u.spent / b.limit) * 100)
            const st = statusFor(pct, threshold)
            const scopeLabel = projectName(b.projectId) ?? 'All usage'
            return (
              <div key={b.id} className="group bg-card border border-borderCard rounded-[14px] p-[20px_22px] relative">
                <button
                  onClick={() => deleteBudget(b.id)}
                  title="Delete budget"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-[6px] flex items-center justify-center hover:bg-[rgba(255,255,255,.06)]"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="#8b93a5" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="flex items-center justify-between mb-[14px]">
                  <div className="flex items-center gap-[9px]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cs.iconBg }}>
                      <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: cs.color }} />
                    </div>
                    <span className="text-textTertiary text-[14.5px] font-semibold">{b.name}</span>
                  </div>
                  <span className="text-xs font-bold px-[9px] py-[3px] rounded-[6px]" style={{ background: st.tagBg, color: st.tagColor }}>
                    {st.label}
                  </span>
                </div>
                <div className="text-white text-[34px] font-extrabold tracking-[-1px]">
                  ${b.limit.toLocaleString()}
                </div>
                <div className="text-textMuted text-[13.5px] font-medium mt-1">
                  {fmtTokens(u.tokens)} compute tokens used
                </div>
                <div className="flex items-center gap-[6px] mt-[6px]">
                  <span className="text-textDim text-[12px] font-medium">Scope:</span>
                  {b.projectId && (
                    <span className="w-[8px] h-[8px] rounded-[2px]" style={{ background: projects.find((p) => p.id === b.projectId)?.color ?? '#5a6478' }} />
                  )}
                  <span className="text-textMuted text-[12px] font-semibold">{scopeLabel}</span>
                </div>
                <div className="mt-3 h-[9px] bg-[#1d2532] rounded-[99px] overflow-hidden">
                  <div className="h-full rounded-[99px]" style={{ width: `${Math.min(pct, 100)}%`, background: cs.barFill }} />
                </div>
                <div className="flex justify-between mt-[9px]">
                  <span className="text-[#aab2c2] text-[13px] font-semibold">{fmtMoney(u.spent)} spent</span>
                  <span className="text-textMuted text-[13px] font-semibold">{pct}% used</span>
                </div>
              </div>
            )
          })}

          <div className="col-start-3 row-start-1 row-span-2 bg-card border border-borderCard rounded-[14px] p-[20px_22px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-textSecondary text-[16.5px] font-bold">Budget History</span>
            </div>
            <div className="flex gap-4 mb-[6px]">
              <div className="flex items-center gap-[7px]">
                <span className="w-[14px] h-[3px] rounded-[2px] bg-[#5b8dff]" />
                <span className="text-textMuted text-[12.5px] font-medium">Current</span>
              </div>
              <div className="flex items-center gap-[7px]">
                <span className="w-[14px] h-[3px] rounded-[2px] bg-[#5a6478]" />
                <span className="text-textMuted text-[12.5px] font-medium">Previous Month</span>
              </div>
            </div>
            <svg width="100%" height="220" viewBox="0 0 340 220" fill="none" preserveAspectRatio="none" className="flex-1">
              <defs>
                <linearGradient id="bh-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5b8dff" stopOpacity=".3" />
                  <stop offset="1" stopColor="#5b8dff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {histGrid.map((g, i) => (
                <g key={i}>
                  <line x1="36" y1={g.y} x2="332" y2={g.y} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
                  <text x="30" y={g.ty} fill="#6c7488" fontSize="10.5" fontFamily="Inter" textAnchor="end">
                    {g.label}
                  </text>
                </g>
              ))}
              <path d={histPrev} fill="none" stroke="#5a6478" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
              <path d={histCurArea} fill="url(#bh-area)" />
              <path d={histCur} fill="none" stroke="#6a9bff" strokeWidth="2.6" strokeLinecap="round" />
              {histX.map((x, i) => (
                <text key={i} x={x.x} y="216" fill="#6c7488" fontSize="10.5" fontFamily="Inter" textAnchor="middle">
                  {x.label}
                </text>
              ))}
            </svg>
          </div>

          <div className="col-start-2 row-start-2 bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="flex items-center justify-between mb-[14px]">
              <span className="text-textSecondary text-[16.5px] font-bold">Forecasting</span>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="13" fill={onTrack ? '#2bb673' : '#e07b3f'} />
                <path d="M7 13.4L11 17.2L19 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-accentGreen text-[15px] font-bold mb-[6px]" style={{ color: onTrack ? '#5fd08a' : '#f0a878' }}>
              {onTrack ? 'On track to stay under budget' : 'Projected to exceed budget'}
            </div>
            <div className="text-textMuted text-[13.5px] font-medium leading-[1.5]">
              Projected end-of-month spend:{' '}
              <span className="text-textSecondary font-bold">${projected.toLocaleString()}</span> of $
              {primary ? primary.limit.toLocaleString() : 0} — about{' '}
              <span className="font-bold" style={{ color: onTrack ? '#5fd08a' : '#f0a878' }}>
                ${Math.abs(spare).toLocaleString()}
              </span>{' '}
              {onTrack ? 'to spare' : 'over'} at current pace.
            </div>
          </div>
        </div>

        {budgets.length > 3 && (
          <div className="grid grid-cols-3 gap-[18px] mb-[18px]">
            {budgets.slice(3).map((b) => {
              const cs = categoryStyle[b.category]
              const pct = Math.round((b.spent / b.limit) * 100)
              const st = statusFor(pct, threshold)
              return (
                <div key={b.id} className="group bg-card border border-borderCard rounded-[14px] p-[20px_22px] relative">
                  <button
                    onClick={() => deleteBudget(b.id)}
                    title="Delete budget"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-[6px] flex items-center justify-center hover:bg-[rgba(255,255,255,.06)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="#8b93a5" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className="flex items-center justify-between mb-[14px]">
                    <div className="flex items-center gap-[9px]">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cs.iconBg }}>
                        <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: cs.color }} />
                      </div>
                      <span className="text-textTertiary text-[14.5px] font-semibold">{b.name}</span>
                    </div>
                    <span className="text-xs font-bold px-[9px] py-[3px] rounded-[6px]" style={{ background: st.tagBg, color: st.tagColor }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-white text-[34px] font-extrabold tracking-[-1px]">${b.limit.toLocaleString()}</div>
                  <div className="text-textMuted text-[13.5px] font-medium mt-1">
                    {fmtTokens(b.tokenUsed)} of {fmtTokens(b.tokenCap)} compute tokens
                  </div>
                  <div className="mt-4 h-[9px] bg-[#1d2532] rounded-[99px] overflow-hidden">
                    <div className="h-full rounded-[99px]" style={{ width: `${Math.min(pct, 100)}%`, background: cs.barFill }} />
                  </div>
                  <div className="flex justify-between mt-[9px]">
                    <span className="text-[#aab2c2] text-[13px] font-semibold">${b.spent.toLocaleString()} spent</span>
                    <span className="text-textMuted text-[13px] font-semibold">{pct}% used</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="bg-card border border-borderCard rounded-[14px] p-[22px_24px]">
          <div className="flex items-start justify-between gap-8 flex-wrap">
            <div className="flex-1 min-w-[340px]">
              <div className="text-textSecondary text-[16.5px] font-bold mb-1">Alert Threshold</div>
              <div className="text-textMuted text-[13.5px] font-medium mb-[22px]">
                Notify me when usage reaches{' '}
                <span className="text-[#7aa5ff] font-bold">{threshold}%</span> of any budget.
              </div>
              <div
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  const pct = Math.max(50, Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 100)))
                  setAlerts({ threshold: pct })
                }}
                className="relative h-[10px] bg-[#1d2532] rounded-[99px] mx-[6px] cursor-pointer"
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-[99px] pointer-events-none"
                  style={{ width: `${threshold}%`, background: 'linear-gradient(90deg,#174dcc,#3770f0)' }}
                />
                <div
                  className="absolute top-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-[#5b8dff] pointer-events-none"
                  style={{ left: `${threshold}%`, transform: 'translate(-50%,-50%)', boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}
                />
              </div>
              <div className="flex gap-[10px] mt-[18px]">
                {[70, 85, 95].map((v) => (
                  <div
                    key={v}
                    onClick={() => setAlerts({ threshold: v })}
                    className="flex-1 text-center py-[9px] rounded-[9px] cursor-pointer text-[13.5px] font-bold border"
                    style={{
                      background: threshold === v ? 'rgba(91,141,255,.18)' : 'transparent',
                      color: threshold === v ? '#7aa5ff' : '#aab2c2',
                      borderColor: threshold === v ? 'rgba(91,141,255,.5)' : 'rgba(255,255,255,.08)',
                    }}
                  >
                    {v}%
                  </div>
                ))}
              </div>
            </div>

            <div className="w-px self-stretch bg-[rgba(255,255,255,.07)]" />

            <div className="flex-1 min-w-[260px]">
              <div className="text-textSecondary text-[16.5px] font-bold mb-1">Alert Channels</div>
              <div className="text-textMuted text-[13.5px] font-medium mb-[22px]">
                Where should we send budget alerts? In-App fires in the notification bell now; email &amp; Slack
                delivery is via integration (coming soon).
              </div>
              <div className="flex flex-col gap-[10px]">
                {(['Email', 'Slack', 'In-App'] as const).map((name) => {
                  const on = channels[name]
                  const live = name === 'In-App'
                  return (
                    <div
                      key={name}
                      onClick={() => setAlerts({ channels: { ...channels, [name]: !on } })}
                      className="flex items-center justify-between p-[13px_16px] rounded-[11px] cursor-pointer border"
                      style={{
                        background: on ? 'rgba(91,141,255,.08)' : '#0c1016',
                        borderColor: on ? 'rgba(91,141,255,.3)' : 'rgba(255,255,255,.07)',
                      }}
                    >
                      <span className="text-[14.5px] font-semibold flex items-center gap-2" style={{ color: on ? '#e9edf4' : '#aab2c2' }}>
                        {name}
                        <span
                          className="text-[10.5px] font-bold px-[6px] py-[1px] rounded-[5px]"
                          style={{
                            background: live ? 'rgba(43,182,115,.16)' : 'rgba(255,255,255,.06)',
                            color: live ? '#5fd08a' : '#8b93a5',
                          }}
                        >
                          {live ? 'Live' : 'Soon'}
                        </span>
                      </span>
                      <div className="w-[38px] h-[22px] rounded-[99px] relative" style={{ background: on ? '#5b8dff' : '#2a3344' }}>
                        <div className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: on ? '18px' : '2px' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
