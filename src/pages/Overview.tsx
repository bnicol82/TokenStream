import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import { SegmentBar, Tag, CheckIcon } from '../components/ui'
import FreeModelsBanner from '../components/FreeModelsBanner'
import EmptyState from '../components/EmptyState'
import { useApp } from '../lib/store'
import { computeAlerts } from '../lib/alerts'
import { fmtMoney } from '../lib/models'
import { totalSpend, totalSaved, savedPct, totalTokens, fmtTokens } from '../lib/selectors'

const providerMax = 9

export default function Overview() {
  const { data } = useApp()
  const navigate = useNavigate()
  const { transactions, budgets } = data
  const topAlert = computeAlerts(data)[0]
  const isEmpty = transactions.length === 0 && budgets.length === 0

  const spend = totalSpend(transactions)
  const budgetCap = budgets[0]?.limit ?? 2000
  const usedTokens = totalTokens(transactions)
  const pct = Math.min(100, Math.round((spend / budgetCap) * 100))
  const saved = totalSaved(transactions)
  const savedPctVal = savedPct(transactions)

  // Connected providers: count of transactions per provider, scaled to 9 segments
  const provCount = new Map<string, number>()
  for (const t of transactions) provCount.set(t.provider, (provCount.get(t.provider) ?? 0) + 1)
  const maxCount = Math.max(1, ...provCount.values())
  const providers = [...provCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, filled: Math.max(1, Math.round((count / maxCount) * providerMax)) }))

  const rows = [...transactions]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6)
    .map((t) => {
      const d = new Date(t.ts)
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`
      return { id: t.id, time, model: t.model, tag: t.tag, tokens: fmtTokens(t.inputTokens + t.outputTokens), cost: fmtMoney(t.cost), optimized: t.optimized }
    })

  // Days to budget at current daily burn
  const daysSpan = Math.max(1, (Date.now() - Math.min(...transactions.map((t) => t.ts), Date.now())) / 86400000)
  const dailyBurn = spend / daysSpan
  const daysToBudget = dailyBurn > 0 ? Math.max(0, Math.round((budgetCap - spend) / dailyBurn)) : 0

  return (
    <Shell>
      <div className="px-[30px] py-[26px] pb-[30px]">
        <div className="flex items-start justify-between mb-[22px]">
          <div>
            <div className="text-white text-[28px] font-extrabold tracking-[-0.5px]">
              Overview
            </div>
            <div className="text-textMuted text-[15px] font-medium mt-[5px]">
              Your AI token spend, optimizations, and ROI at a glance.
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#aab2c2] text-sm font-semibold px-[15px] py-[9px] rounded-[9px] border border-borderInput cursor-pointer">
            April 2026
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 4L5.5 7.5L9 4" stroke="#8b93a5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {topAlert && (
          <div
            onClick={() => navigate(topAlert.kind === 'project' ? '/projects' : '/budgets')}
            className="flex items-center justify-between gap-4 rounded-[14px] p-[16px_20px] mb-5 cursor-pointer"
            style={{
              background: topAlert.severity === 'over' ? 'linear-gradient(120deg,#2a1414,#1a0f12)' : 'linear-gradient(120deg,#2a2014,#1a140e)',
              border: `1px solid ${topAlert.severity === 'over' ? 'rgba(240,89,60,.4)' : 'rgba(240,168,120,.4)'}`,
            }}
          >
            <div className="flex items-center gap-[14px] min-w-0">
              <span
                className="flex-none w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[18px]"
                style={{ background: topAlert.severity === 'over' ? 'rgba(240,89,60,.16)' : 'rgba(240,168,120,.16)' }}
              >
                {topAlert.severity === 'over' ? '🚨' : '⚠️'}
              </span>
              <div className="min-w-0">
                <div className="text-white text-[15.5px] font-bold">
                  {topAlert.name} is {topAlert.severity === 'over' ? 'over budget' : `at ${topAlert.pct}% of budget`}
                </div>
                <div className="text-textMuted text-[13px] font-medium mt-[2px]">
                  {fmtMoney(topAlert.spent)} of ${topAlert.limit.toLocaleString()} used · review your {topAlert.kind}s →
                </div>
              </div>
            </div>
            <span
              className="flex-none text-[15px] font-extrabold"
              style={{ color: topAlert.severity === 'over' ? '#f0593c' : '#f0a878' }}
            >
              {topAlert.pct}%
            </span>
          </div>
        )}

        <FreeModelsBanner ctaLabel="Switch to free models" onAction={() => navigate('/optimization')} />

        {isEmpty ? (
          <EmptyState
            emoji="👋"
            title="Welcome — let's get your first numbers in"
            body="Start a chat and TokenStream automatically routes to the cheapest capable model, tracks the cost, and fills in your spend, savings, and ROI here."
            ctaLabel="Start chatting"
            onCta={() => navigate('/chat')}
            secondaryLabel="Set a budget"
            onSecondary={() => navigate('/budgets')}
          />
        ) : (
        <>
        <div className="grid grid-cols-[1.95fr_1fr] gap-5 mb-5">
          <div className="bg-card border border-borderCard rounded-2xl p-[26px_30px]">
            <div className="text-textTertiary text-xl font-semibold mb-[14px]">
              Current Monthly Spend
            </div>
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div className="flex items-baseline gap-[14px]">
                <span className="text-white text-[62px] font-extrabold tracking-[-2px] leading-none">
                  ${Math.round(spend).toLocaleString()}
                </span>
                <span className="text-textMuted text-xl font-medium">/ {usedTokens.toLocaleString()} tokens used</span>
              </div>
              <span className="text-textSecondary text-[34px] font-bold tracking-[-1px]">
                ${budgetCap.toLocaleString()}
              </span>
            </div>
            <div className="mt-[22px] h-[11px] bg-[#1d2532] rounded-[99px] overflow-hidden">
              <div
                className="h-full rounded-[99px]"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#3f6fe0,#6a9bff)' }}
              />
            </div>
            <div className="flex justify-between mt-[11px]">
              <span className="text-textDim text-[15px] font-medium">Usage</span>
              <span className="text-textDim text-[15px] font-medium">Budget</span>
            </div>
          </div>

          <div className="bg-card border border-borderCard rounded-2xl p-[26px_28px] flex flex-col justify-between">
            <div className="text-textTertiary text-xl font-semibold leading-[1.3]">
              Auto-Optimizations
              <br />
              Applied This Month
            </div>
            <div className="mt-5">
              <span className="text-white text-[38px] font-extrabold tracking-[-1px]">Saved {savedPctVal}%</span>
              <span className="text-accentGreen text-[38px] font-extrabold tracking-[-1px]"> ({fmtMoney(saved)})</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_2.55fr] gap-5 items-stretch">
          <div className="flex flex-col gap-5">
            <div className="bg-card border border-borderCard rounded-2xl p-[22px_24px]">
              <div className="text-[#c9cfdb] text-[18px] font-semibold leading-[1.35] mb-[14px]">
                Projected to hit budget in <span className="text-white">{daysToBudget} days</span> at current rate
              </div>
              <svg width="100%" height="130" viewBox="0 0 280 130" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ts-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5b8dff" stopOpacity=".35" />
                    <stop offset="1" stopColor="#5b8dff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 108 C40 104 55 96 80 92 C108 88 120 70 150 64 C185 57 200 30 280 8 L280 130 L0 130 Z"
                  fill="url(#ts-area)"
                />
                <path
                  d="M0 108 C40 104 55 96 80 92 C108 88 120 70 150 64 C185 57 200 30 280 8"
                  stroke="#6a9bff"
                  strokeWidth="2.6"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M268 16 L280 8 L276 22"
                  stroke="#6a9bff"
                  strokeWidth="2.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="bg-card border border-borderCard rounded-2xl p-[22px_24px] flex-1">
              <div className="text-textSecondary text-[18px] font-bold mb-[18px]">
                Connected Providers
              </div>
              {providers.map((p) => (
                <div key={p.name} className="flex items-center justify-between mb-4">
                  <span className="text-textTertiary text-base font-semibold">{p.name}</span>
                  <SegmentBar filled={p.filled} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-borderCard rounded-2xl p-[24px_28px]">
            <div className="flex items-center justify-between mb-[6px]">
              <span className="text-white text-[22px] font-bold">Recent Activity</span>
              <div className="bg-navActive text-[#aab2c2] text-[14.5px] font-semibold px-[18px] py-[9px] rounded-[9px] border border-borderCard cursor-pointer">
                Last 24 hours
              </div>
            </div>

            <div className="grid grid-cols-[1.3fr_1.2fr_1.1fr_.9fr_.9fr_.9fr] gap-2 py-[14px] pb-3 border-b border-[rgba(255,255,255,.07)]">
              <span className="text-textMuted text-[15px] font-semibold">Timestamp</span>
              <span className="text-textMuted text-[15px] font-semibold">Model</span>
              <span className="text-textMuted text-[15px] font-semibold">Task Tag</span>
              <span className="text-textMuted text-[15px] font-semibold">Tokens</span>
              <span className="text-textMuted text-[15px] font-semibold">Cost</span>
              <span className="text-textMuted text-[15px] font-semibold">Optimized?</span>
            </div>

            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.3fr_1.2fr_1.1fr_.9fr_.9fr_.9fr] gap-2 items-center py-[13px] border-b border-[rgba(255,255,255,.04)]"
              >
                <span className="text-textTertiary text-[15.5px] font-medium">{r.time}</span>
                <span className="text-[#d6dbe6] text-[15.5px] font-medium">{r.model}</span>
                <div>
                  <Tag>{r.tag}</Tag>
                </div>
                <span className="text-textTertiary text-[15.5px] font-medium">{r.tokens}</span>
                <span className="text-[#d6dbe6] text-[15.5px] font-semibold">{r.cost}</span>
                <div>
                  {r.optimized ? (
                    <CheckIcon size={22} />
                  ) : (
                    <span className="text-textDim text-[15.5px]">—</span>
                  )}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-6 mt-[22px] pt-[22px] border-t border-[rgba(255,255,255,.07)]">
              <div>
                <div className="text-textSecondary text-[17px] font-bold mb-[6px]">ROI Attribution</div>
                <div className="text-textMuted text-[15px] font-medium leading-[1.5]">
                  Tax queries: 3,200 tokens → est.{' '}
                  <span className="text-accentGreen font-semibold">$1,800</span> in filings avoided
                </div>
              </div>
              <div>
                <div className="text-textSecondary text-[17px] font-bold mb-[6px]">Time Saved</div>
                <div className="text-textMuted text-[15px] font-medium leading-[1.5]">
                  <span className="text-accentGreen font-semibold">$450</span> saved in accountant time
                  this cycle
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </Shell>
  )
}
