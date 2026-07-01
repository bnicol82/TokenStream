import { useMemo, useState } from 'react'
import Shell from '../components/Shell'
import { useApp } from '../lib/app-context'
import { fmtMoney } from '../lib/models'
import { fmtTokens, totalSpend, projectSpent, projectTokens } from '../lib/selectors'
import { PROJECT_COLORS, parseKeywords } from '../lib/projects'

const emptyForm = { name: '', color: PROJECT_COLORS[0], keywords: '', budget: '' }

function statusFor(pct: number, threshold = 85) {
  if (pct >= threshold) return { label: 'Near limit', tagBg: 'rgba(240,145,90,.16)', tagColor: '#f0a878' }
  if (pct >= 100) return { label: 'Over budget', tagBg: 'rgba(240,90,90,.16)', tagColor: '#f08a8a' }
  return { label: 'On track', tagBg: 'rgba(43,182,115,.16)', tagColor: '#5fd08a' }
}

export default function Projects() {
  const { data, addProject, deleteProject, setActiveProject } = useApp()
  const { projects, transactions, activeProjectId } = data
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const total = useMemo(() => totalSpend(transactions), [transactions])
  const unassignedSpend = useMemo(() => projectSpent(transactions, null), [transactions])
  const unassignedTokens = useMemo(() => projectTokens(transactions, null), [transactions])

  const submit = () => {
    if (!form.name.trim()) return
    addProject({
      name: form.name.trim(),
      color: form.color,
      keywords: parseKeywords(form.keywords),
      budget: parseFloat(form.budget) || 0,
    })
    setForm(emptyForm)
    setShowForm(false)
  }

  const pctOfTotal = (cost: number) => (total > 0 ? Math.round((cost / total) * 100) : 0)

  return (
    <Shell>
      <div className="px-[30px] py-[26px] pb-[30px]">
        <div className="flex items-start justify-between mb-[22px]">
          <div>
            <div className="text-white text-[28px] font-extrabold tracking-[-0.5px]">Projects</div>
            <div className="text-textMuted text-[15px] font-medium mt-[5px]">
              Track what each project costs in AI. New chats are auto-assigned by keywords, or to your active project.
            </div>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 bg-primary-gradient text-white text-sm font-semibold px-[18px] py-[9px] rounded-[9px] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New Project
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-borderCard rounded-[14px] p-[18px_22px] mb-[18px] flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acme Website"
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] w-[200px]"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">
                Keywords (comma-separated)
              </label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="acme, redesign, landing page"
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Budget ($/mo)</label>
              <input
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0 = none"
                inputMode="decimal"
                className="bg-input border border-borderInput rounded-[9px] px-3 py-2 text-textSecondary text-sm outline-none focus:border-[rgba(91,141,255,.5)] w-[110px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px]">Color</label>
              <div className="flex gap-[6px] py-1">
                {PROJECT_COLORS.map((c) => (
                  <span
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-[22px] h-[22px] rounded-[6px] cursor-pointer"
                    style={{ background: c, outline: form.color === c ? '2px solid #fff' : 'none', outlineOffset: '1px' }}
                  />
                ))}
              </div>
            </div>
            <button onClick={submit} className="bg-primary-gradient text-white text-sm font-semibold px-[18px] py-2 rounded-[9px]">
              Add
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-[#aab2c2] text-sm font-semibold px-3 py-2 rounded-[9px] border border-borderInput"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Active project selector */}
        <div className="bg-card border border-borderCard rounded-[14px] p-[16px_20px] mb-[18px]">
          <div className="text-textMuted text-[12px] font-semibold uppercase tracking-[0.4px] mb-[10px]">
            Active project — new chats are assigned here until you switch
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveProject(null)}
              className="text-[13px] font-semibold px-[12px] py-[7px] rounded-[8px] cursor-pointer border"
              style={{
                background: activeProjectId === null ? 'rgba(91,141,255,.18)' : 'transparent',
                color: activeProjectId === null ? '#7aa5ff' : '#aab2c2',
                borderColor: activeProjectId === null ? 'rgba(91,141,255,.5)' : 'rgba(255,255,255,.08)',
              }}
            >
              Auto-detect
            </button>
            {projects.map((p) => {
              const on = activeProjectId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  className="flex items-center gap-[7px] text-[13px] font-semibold px-[12px] py-[7px] rounded-[8px] cursor-pointer border"
                  style={{
                    background: on ? 'rgba(91,141,255,.18)' : 'transparent',
                    color: on ? '#fff' : '#aab2c2',
                    borderColor: on ? 'rgba(91,141,255,.5)' : 'rgba(255,255,255,.08)',
                  }}
                >
                  <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: p.color }} />
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>

        {projects.length === 0 && (
          <div className="bg-card border border-borderCard rounded-[14px] p-[40px] text-center text-textMuted">
            No projects yet. Create one to start tracking AI cost per initiative.
          </div>
        )}

        <div className="grid grid-cols-3 gap-[18px]">
          {projects.map((p) => {
            const cost = projectSpent(transactions, p.id)
            const tokens = projectTokens(transactions, p.id)
            const pct = p.budget > 0 ? Math.round((cost / p.budget) * 100) : 0
            const st = statusFor(pct)
            return (
              <div key={p.id} className="group bg-card border border-borderCard rounded-[14px] p-[20px_22px] relative">
                <button
                  onClick={() => deleteProject(p.id)}
                  title="Delete project"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-[6px] flex items-center justify-center hover:bg-[rgba(255,255,255,.06)]"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="#8b93a5" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="flex items-center justify-between mb-[14px]">
                  <div className="flex items-center gap-[9px]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: p.color + '26' }}>
                      <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: p.color }} />
                    </div>
                    <span className="text-textTertiary text-[14.5px] font-semibold">{p.name}</span>
                  </div>
                  {p.budget > 0 && (
                    <span className="text-xs font-bold px-[9px] py-[3px] rounded-[6px]" style={{ background: st.tagBg, color: st.tagColor }}>
                      {st.label}
                    </span>
                  )}
                </div>
                <div className="text-white text-[34px] font-extrabold tracking-[-1px]">{fmtMoney(cost)}</div>
                <div className="text-textMuted text-[13.5px] font-medium mt-1">
                  {fmtTokens(tokens)} tokens · {pctOfTotal(cost)}% of spend
                </div>
                {p.budget > 0 ? (
                  <>
                    <div className="mt-4 h-[9px] bg-[#1d2532] rounded-[99px] overflow-hidden">
                      <div
                        className="h-full rounded-[99px]"
                        style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg,${p.color},${p.color}cc)` }}
                      />
                    </div>
                    <div className="flex justify-between mt-[9px]">
                      <span className="text-[#aab2c2] text-[13px] font-semibold">{fmtMoney(cost)} of ${p.budget.toLocaleString()}</span>
                      <span className="text-textMuted text-[13px] font-semibold">{pct}% used</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 text-textMuted text-[12.5px] font-medium">No budget set</div>
                )}
                {p.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-[6px] mt-3 pt-3 border-t border-[rgba(255,255,255,.06)]">
                    {p.keywords.slice(0, 6).map((k) => (
                      <span key={k} className="text-textMuted text-[11px] font-medium bg-app border border-borderCard rounded-[5px] px-[7px] py-[2px]">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {unassignedSpend > 0 && (
            <div className="bg-card border border-dashed border-borderCard rounded-[14px] p-[20px_22px]">
              <div className="flex items-center gap-[9px] mb-[14px]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(255,255,255,.05)]">
                  <span className="w-[11px] h-[11px] rounded-[3px] bg-[#5a6478]" />
                </div>
                <span className="text-textTertiary text-[14.5px] font-semibold">Unassigned</span>
              </div>
              <div className="text-white text-[34px] font-extrabold tracking-[-1px]">{fmtMoney(unassignedSpend)}</div>
              <div className="text-textMuted text-[13.5px] font-medium mt-1">
                {fmtTokens(unassignedTokens)} tokens · {pctOfTotal(unassignedSpend)}% of spend
              </div>
              <div className="mt-4 text-textMuted text-[12.5px] font-medium">
                Usage not matched to a project. Add keywords to a project to capture it.
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
