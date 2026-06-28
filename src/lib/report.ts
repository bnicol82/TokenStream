import type { AppData } from './types'
import { fmtMoney } from './models'
import {
  totalSpend,
  totalSaved,
  savedPct,
  totalTokens,
  spendByProvider,
  spendByProject,
  fmtTokens,
} from './selectors'

// Build a self-contained printable HTML report and open it in a new window with
// the print dialog (→ Save as PDF). No dependencies.
export function exportReport(data: AppData) {
  const txns = data.transactions
  const spend = totalSpend(txns)
  const saved = totalSaved(txns)
  const projName = new Map(data.projects.map((p) => [p.id, p.name]))

  const kpis = [
    ['Total Spend', fmtMoney(spend)],
    ['Total Saved', fmtMoney(saved)],
    ['Savings Rate', `${savedPct(txns)}%`],
    ['Total Tokens', fmtTokens(totalTokens(txns))],
  ]

  const providerRows = spendByProvider(txns)
    .map((r) => `<tr><td>${esc(r.provider)}</td><td class="num">${fmtMoney(r.cost)}</td></tr>`)
    .join('')

  const projectRows = spendByProject(txns)
    .map((r) => {
      const name = r.projectId === 'Unassigned' ? 'Unassigned' : projName.get(r.projectId) ?? 'Unassigned'
      const pct = spend > 0 ? Math.round((r.cost / spend) * 100) : 0
      return `<tr><td>${esc(name)}</td><td class="num">${fmtMoney(r.cost)}</td><td class="num">${pct}%</td></tr>`
    })
    .join('')

  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>TokenStream Report</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1f29; margin: 0; padding: 28px; }
  h1 { font-size: 24px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .kpis { display: flex; gap: 14px; margin-bottom: 26px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 130px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .kpi .label { color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
  .kpi .val { font-size: 26px; font-weight: 800; margin-top: 6px; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eceef1; }
  th { color: #6b7280; font-weight: 600; }
  td.num, th.num { text-align: right; }
  .foot { margin-top: 28px; color: #9ca3af; font-size: 11px; }
</style></head><body>
  <h1>TokenStream — AI Spend Report</h1>
  <div class="sub">Generated ${esc(generated)}</div>
  <div class="kpis">
    ${kpis.map(([l, v]) => `<div class="kpi"><div class="label">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join('')}
  </div>
  <h2>Spend by Provider</h2>
  <table><thead><tr><th>Provider</th><th class="num">Cost</th></tr></thead>
  <tbody>${providerRows || '<tr><td colspan="2">No usage yet.</td></tr>'}</tbody></table>
  <h2>Cost by Project</h2>
  <table><thead><tr><th>Project</th><th class="num">Cost</th><th class="num">Share</th></tr></thead>
  <tbody>${projectRows || '<tr><td colspan="3">No usage yet.</td></tr>'}</tbody></table>
  <div class="foot">TokenStream · ${esc(fmtMoney(saved))} saved vs. running every call on a frontier model.</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to export the report.')
    return
  }
  win.document.write(html)
  win.document.close()
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}
