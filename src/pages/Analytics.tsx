import Shell from '../components/Shell'
import { useApp } from '../lib/store'
import {
  totalTokens,
  avgCostPer1k,
  totalSaved,
  totalSpend,
  tokensByTag,
  spendByProject,
  projectTokens,
  fmtTokens,
  fmtMoneyShort,
  UNASSIGNED_KEY,
} from '../lib/selectors'
import { fmtMoney } from '../lib/models'
import { exportReport } from '../lib/report'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const series = [
  { name: 'Other', fill: 'rgba(240,145,90,.55)', stroke: '#f0915a', vals: [2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3] },
  { name: 'Coding', fill: 'rgba(155,107,255,.55)', stroke: '#9b6bff', vals: [2, 2, 3, 3, 3, 4, 3, 3, 2, 3, 3, 3] },
  { name: 'Research', fill: 'rgba(91,141,255,.55)', stroke: '#5b8dff', vals: [3, 3, 4, 4, 5, 5, 4, 4, 3, 4, 4, 5] },
  { name: 'Tax', fill: 'rgba(62,201,138,.55)', stroke: '#3ec98a', vals: [4, 5, 6, 8, 9, 8, 7, 6, 5, 5, 6, 7] },
]
const x0 = 44,
  x1 = 512,
  yTop = 18,
  yBot = 188,
  maxV = 22
const X = (i: number) => x0 + ((x1 - x0) * i) / (months.length - 1)
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
const lowerVals = months.map(() => 0)
const areas = series.map((s) => {
  const upperPts = months.map((_, i) => ({ x: X(i), y: Y(lowerVals[i] + s.vals[i]) }))
  const lowerPts = months.map((_, i) => ({ x: X(i), y: Y(lowerVals[i]) }))
  const lrev = [...lowerPts].reverse()
  const d =
    `M ${upperPts[0].x.toFixed(1)} ${upperPts[0].y.toFixed(1)}` +
    curve(upperPts) +
    ` L ${lrev[0].x.toFixed(1)} ${lrev[0].y.toFixed(1)}` +
    curve(lrev) +
    ' Z'
  for (let i = 0; i < months.length; i++) lowerVals[i] += s.vals[i]
  return { d, fill: s.fill, stroke: s.stroke }
})
const areaLegend = [...series].reverse().map((s) => ({ name: s.name, color: s.stroke }))
const areaTicks = [20, 15, 10, 5, 0]
const areaGrid = areaTicks.map((t) => {
  const y = Y(t)
  return { y, ty: y + 4, label: t ? t + 'k' : '0' }
})
const areaX = months.map((m, i) => ({ x: X(i), label: m }))

const C = 2 * Math.PI * 52
const segs = [
  { name: 'Caching', pct: 45, color: '#5b8dff' },
  { name: 'Prompt Engineering', pct: 35, color: '#f0915a' },
  { name: 'Model Selection', pct: 20, color: '#9b6bff' },
]
let cum = 0
const donut = segs.map((s) => {
  const len = (s.pct / 100) * C
  const offset = -cum
  cum += len
  return { name: s.name, color: s.color, pctLabel: s.pct + '%', dash: `${len.toFixed(1)} ${(C - len).toFixed(1)}`, offset: offset.toFixed(1) }
})

const recs = [
  'Route more Tax queries to DeepSeek for 62% lower cost',
  'Implement caching for repetitive Coding tasks to save 40%',
  'Batch Research queries to cut request overhead by 18%',
]

// Heuristic business-value multipliers per tag (illustrative ROI mapping)
const tagValueMult: Record<string, number> = { Tax: 0.9, Research: 0.4, Code: 0.5, General: 0.3, Triage: 0.25, Writing: 0.35 }
const tagRoiMult: Record<string, number> = { Tax: 3.2, Research: 3.1, Code: 2.5, General: 2.0, Triage: 1.9, Writing: 2.2 }

export default function Analytics() {
  const { data } = useApp()
  const txns = data.transactions

  const spendTotal = totalSpend(txns)
  const projById = new Map(data.projects.map((p) => [p.id, p]))
  const projectRows = spendByProject(txns).map(({ projectId, cost }) => {
    const p = projById.get(projectId)
    return {
      key: projectId,
      name: p?.name ?? 'Unassigned',
      color: p?.color ?? '#5a6478',
      cost,
      tokens: projectTokens(txns, projectId === UNASSIGNED_KEY ? null : projectId),
      pct: spendTotal > 0 ? Math.round((cost / spendTotal) * 100) : 0,
    }
  })

  const tokens = totalTokens(txns)
  const saved = totalSaved(txns)
  const kpis = [
    { label: 'Total Tokens This Month', value: fmtTokens(tokens) },
    { label: 'Avg Cost per 1K Tokens', value: '$' + avgCostPer1k(txns).toFixed(2) },
    { label: 'Total Savings from Optimizations', value: fmtMoneyShort(saved) },
    { label: 'Estimated ROI Multiple', value: (totalSpend(txns) > 0 ? 1 + saved / totalSpend(txns) : 0).toFixed(1) + 'x' },
  ]
  const savedLabel = fmtMoneyShort(saved)

  const roi = tokensByTag(txns)
    .slice(0, 5)
    .map(({ tag, tokens: tk }) => ({
      tag,
      tokens: fmtTokens(tk),
      value: fmtMoneyShort((tk / 1000) * (tagValueMult[tag] ?? 0.3) * 100),
      roi: (tagRoiMult[tag] ?? 2.0).toFixed(1) + 'x',
    }))

  return (
    <Shell>
      <div className="px-[30px] py-[26px] pb-[30px]">
        <div className="flex items-center justify-between mb-[22px]">
          <span className="text-white text-[28px] font-extrabold tracking-[-0.5px]">
            Token Analytics &amp; ROI Insights
          </span>
          <div className="flex items-center gap-[10px]">
            <div className="flex items-center gap-2 text-[#aab2c2] text-sm font-semibold px-[15px] py-[9px] rounded-[9px] border border-borderInput cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1.5l1.4 3.4 3.6.3-2.8 2.3.9 3.5L7 9.6 3.9 11.3l.9-3.5L2 5.5l3.6-.3L7 1.5Z"
                  stroke="#7aa5ff"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              AI Insights
            </div>
            <div
              onClick={() => exportReport(data)}
              className="bg-primary-gradient text-white text-sm font-semibold px-[18px] py-[9px] rounded-[9px] cursor-pointer"
            >
              Export Report
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-5">
          {kpis.map((k) => (
            <div key={k.label} className="bg-card border border-borderCard rounded-[14px] p-[18px_20px]">
              <div className="text-textMuted text-[13.5px] font-semibold mb-3">{k.label}</div>
              <div className="text-white text-[32px] font-extrabold tracking-[-1px]">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1.55fr_1fr] gap-[18px] mb-5">
          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="text-textSecondary text-[16.5px] font-bold mb-4">
              Token Consumption by Task Category over Time
            </div>
            <div className="flex gap-[18px]">
              <svg width="100%" height="210" viewBox="0 0 520 210" fill="none" preserveAspectRatio="none" className="flex-1">
                {areaGrid.map((g, i) => (
                  <g key={i}>
                    <line x1="44" y1={g.y} x2="512" y2={g.y} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
                    <text x="36" y={g.ty} fill="#6c7488" fontSize="11" fontFamily="Inter" textAnchor="end">
                      {g.label}
                    </text>
                  </g>
                ))}
                {areas.map((a, i) => (
                  <path key={i} d={a.d} fill={a.fill} stroke={a.stroke} strokeWidth="1.4" />
                ))}
                {areaX.map((x, i) => (
                  <text key={i} x={x.x} y="206" fill="#6c7488" fontSize="10.5" fontFamily="Inter" textAnchor="middle">
                    {x.label}
                  </text>
                ))}
              </svg>
              <div className="flex flex-col gap-[11px] justify-center">
                {areaLegend.map((l) => (
                  <div key={l.name} className="flex items-center gap-2">
                    <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: l.color }} />
                    <span className="text-[#aab2c2] text-[13.5px] font-medium">{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="text-textSecondary text-[16.5px] font-bold mb-2">
              Savings Breakdown by Optimization Type
            </div>
            <div className="flex items-center gap-5">
              <svg width="150" height="150" viewBox="0 0 140 140" fill="none" className="flex-none">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#1d2532" strokeWidth="22" />
                {donut.map((d, i) => (
                  <circle
                    key={i}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={d.color}
                    strokeWidth="22"
                    strokeDasharray={d.dash}
                    strokeDashoffset={d.offset}
                    transform="rotate(-90 70 70)"
                  />
                ))}
                <text x="70" y="66" fill="#8b93a5" fontSize="11" fontFamily="Inter" textAnchor="middle">
                  Total Saved
                </text>
                <text x="70" y="84" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Inter" textAnchor="middle">
                  {savedLabel}
                </text>
              </svg>
              <div className="flex flex-col gap-[14px] flex-1">
                {donut.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-[9px]">
                      <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: d.color }} />
                      <span className="text-textTertiary text-sm font-medium">{d.name}</span>
                    </div>
                    <span className="text-white text-sm font-bold">{d.pctLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1.55fr_1fr] gap-[18px]">
          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="text-textSecondary text-[16.5px] font-bold mb-[14px]">
              Highest ROI Activities
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_1.2fr_.7fr] gap-2 pb-3 border-b border-[rgba(255,255,255,.07)]">
              <span className="text-textMuted text-[13.5px] font-semibold">Task Tag</span>
              <span className="text-textMuted text-[13.5px] font-semibold">Tokens Used</span>
              <span className="text-textMuted text-[13.5px] font-semibold">Est. Business Value</span>
              <span className="text-textMuted text-[13.5px] font-semibold text-right">ROI</span>
            </div>
            {roi.map((r) => (
              <div
                key={r.tag}
                className="grid grid-cols-[1.4fr_1fr_1.2fr_.7fr] gap-2 items-center py-[13px] border-b border-[rgba(255,255,255,.04)]"
              >
                <span className="text-[#d6dbe6] text-[14.5px] font-medium">{r.tag}</span>
                <span className="text-[#aab2c2] text-[14.5px]">{r.tokens}</span>
                <span className="text-[#d6dbe6] text-[14.5px] font-semibold">{r.value}</span>
                <div className="text-right">
                  <span className="bg-[rgba(43,182,115,.16)] text-accentGreen text-[13px] font-bold px-[10px] py-1 rounded-[7px]">
                    {r.roi}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px]">
            <div className="text-textSecondary text-[16.5px] font-bold mb-[14px]">Recommendations</div>
            <div className="flex flex-col gap-[11px]">
              {recs.map((r, i) => (
                <div
                  key={i}
                  className="flex gap-[11px] items-start bg-app border border-borderCard rounded-[11px] p-[13px_14px]"
                >
                  <div className="w-[26px] h-[26px] rounded-[7px] bg-[rgba(91,141,255,.14)] flex items-center justify-center flex-none mt-px">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 1.2l1.5 4 4.3.2-3.4 2.7 1.1 4.2L7 10l-3.5 2.3 1.1-4.2L1.2 5.4l4.3-.2L7 1.2Z"
                        fill="#7aa5ff"
                      />
                    </svg>
                  </div>
                  <span className="text-textTertiary text-sm font-medium leading-[1.45]">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-borderCard rounded-[14px] p-[20px_22px] mt-5">
          <div className="text-textSecondary text-[16.5px] font-bold mb-[14px]">Cost by Project</div>
          {projectRows.length === 0 ? (
            <div className="text-textMuted text-sm py-6 text-center">No usage yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1.6fr_1fr_1fr_1.4fr] gap-2 pb-3 border-b border-[rgba(255,255,255,.07)]">
                <span className="text-textMuted text-[13.5px] font-semibold">Project</span>
                <span className="text-textMuted text-[13.5px] font-semibold">Tokens</span>
                <span className="text-textMuted text-[13.5px] font-semibold">Cost</span>
                <span className="text-textMuted text-[13.5px] font-semibold">Share of spend</span>
              </div>
              {projectRows.map((r) => (
                <div
                  key={r.key}
                  className="grid grid-cols-[1.6fr_1fr_1fr_1.4fr] gap-2 items-center py-[13px] border-b border-[rgba(255,255,255,.04)]"
                >
                  <span className="flex items-center gap-[8px] text-[#d6dbe6] text-[14.5px] font-medium">
                    <span className="w-[10px] h-[10px] rounded-[3px] flex-none" style={{ background: r.color }} />
                    {r.name}
                  </span>
                  <span className="text-[#aab2c2] text-[14.5px]">{fmtTokens(r.tokens)}</span>
                  <span className="text-[#d6dbe6] text-[14.5px] font-semibold">{fmtMoney(r.cost)}</span>
                  <div className="flex items-center gap-[10px]">
                    <div className="flex-1 h-[7px] bg-[#1d2532] rounded-[99px] overflow-hidden">
                      <div className="h-full rounded-[99px]" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <span className="text-textMuted text-[13px] font-semibold w-[34px] text-right">{r.pct}%</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
