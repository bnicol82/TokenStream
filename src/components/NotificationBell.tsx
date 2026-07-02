import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app-context'
import { fmtMoney } from '../lib/models'
import { computeAlerts, readSeenAlerts, markAlertsSeen } from '../lib/alerts'

export default function NotificationBell() {
  const { data } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // Bump to recompute unread after marking seen.
  const [seenTick, setSeenTick] = useState(0)

  const alerts = useMemo(() => computeAlerts(data), [data])
  const unread = useMemo(() => {
    const seen = readSeenAlerts()
    return alerts.filter((a) => !seen.has(a.key)).length
    // seenTick forces recompute after markAlertsSeen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, seenTick])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      markAlertsSeen(alerts.map((a) => a.key))
      setSeenTick((t) => t + 1)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative w-[34px] h-[34px] rounded-[9px] flex items-center justify-center border border-borderInput hover:border-white/20 cursor-pointer"
        title="Alerts"
      >
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 2a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.2 4.8-1.2 4.8h11.4s-1.2-1.3-1.2-4.8A4.5 4.5 0 0 0 9 2ZM7.4 15a1.7 1.7 0 0 0 3.2 0"
            stroke="#aab2c2"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-[5px] -right-[5px] min-w-[17px] h-[17px] px-[4px] rounded-full bg-[#f0593c] text-white text-[10.5px] font-bold flex items-center justify-center border-2 border-app">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[60px] sm:top-auto sm:mt-2 w-auto sm:w-[320px] z-50 bg-card border border-borderCard rounded-[12px] shadow-shell overflow-hidden">
            <div className="px-[16px] py-[12px] border-b border-borderSubtle text-white text-[14px] font-bold">
              Alerts
            </div>
            {alerts.length === 0 ? (
              <div className="px-[16px] py-[20px] text-textMuted text-[13px] text-center">No active alerts.</div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto">
                {alerts.map((a) => {
                  const color = a.severity === 'over' ? '#f0593c' : '#f0a878'
                  return (
                    <div
                      key={a.key}
                      onClick={() => {
                        setOpen(false)
                        navigate(a.kind === 'project' ? '/projects' : '/budgets')
                      }}
                      className="px-[16px] py-[12px] border-b border-[rgba(255,255,255,.04)] cursor-pointer hover:bg-[rgba(255,255,255,.03)]"
                    >
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className="text-textSecondary text-[13.5px] font-semibold flex items-center gap-[7px]">
                          <span className="w-[8px] h-[8px] rounded-full" style={{ background: color }} />
                          {a.name}
                        </span>
                        <span className="text-[12px] font-bold" style={{ color }}>
                          {a.pct}%
                        </span>
                      </div>
                      <div className="text-textMuted text-[12px] font-medium pl-[15px]">
                        {a.severity === 'over' ? 'Over budget' : 'Near limit'} · {fmtMoney(a.spent)} of $
                        {a.limit.toLocaleString()} · {a.kind}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
