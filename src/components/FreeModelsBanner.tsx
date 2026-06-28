import { useState } from 'react'
import { useApp } from '../lib/store'
import { fmtMoney } from '../lib/models'
import { freeModelSavings, paidSpendPct } from '../lib/selectors'

const DISMISS_KEY = 'tokenstream:promo:freeModels:dismissed'

// Promotes switching paid usage to free-tier models, with the user's real
// could-be-saved dollar figure. Dismiss persists across reloads.
export default function FreeModelsBanner({
  ctaLabel,
  onAction,
}: {
  ctaLabel: string
  onAction: () => void
}) {
  const { data } = useApp()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const savings = freeModelSavings(data.transactions)
  const pct = paidSpendPct(data.transactions)
  if (dismissed || savings <= 0) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[14px] border border-[rgba(43,182,115,.32)] p-[16px_20px] mb-5"
      style={{ background: 'linear-gradient(120deg,#10241c,#0e1620)' }}
    >
      <div className="flex items-center gap-[14px] min-w-0">
        <span className="flex-none w-[34px] h-[34px] rounded-[9px] bg-[rgba(43,182,115,.16)] flex items-center justify-center text-[18px]">
          💚
        </span>
        <div className="min-w-0">
          <div className="text-white text-[15.5px] font-bold">
            You spent {fmtMoney(savings)} on paid models — the same work runs free
          </div>
          <div className="text-textMuted text-[13px] font-medium mt-[2px]">
            {pct}% of your spend is on paid models. Switch those tasks to free-tier models and pay $0.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <button
          onClick={onAction}
          className="bg-[#2bb673] text-white text-[13px] font-bold px-[14px] py-[9px] rounded-[9px] cursor-pointer hover:brightness-110"
        >
          {ctaLabel}
        </button>
        <button
          onClick={dismiss}
          className="text-textMuted text-[18px] leading-none px-[6px] cursor-pointer hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
