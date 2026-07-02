import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Persistent bottom tab bar for phones (hidden md+). The four core pages get a
// tab; the rest live under "More". Standard mobile-app navigation pattern so
// users aren't forced through the hamburger menu for every page switch.

const tabs = [
  {
    to: '/',
    label: 'Overview',
    icon: (
      <path d="M3 10.5L11 3.5L19 10.5M5 9v8.5h4.5V13h3v4.5H17V9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    to: '/chat',
    label: 'Chat',
    icon: (
      <path d="M4 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8.5L5 18v-3.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    to: '/spend-tracking',
    label: 'Spend',
    icon: (
      <path d="M3.5 18.5v-6h3.4v6M9.3 18.5V8.5h3.4v10M15.1 18.5V4h3.4v14.5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    to: '/budgets',
    label: 'Budgets',
    icon: (
      <>
        <circle cx="11" cy="11.5" r="7.2" strokeWidth="1.7" />
        <path d="M11 8v3.5l2.5 2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
]

const moreLinks = [
  { to: '/optimization', label: 'Optimization', desc: 'Routing rules, compression & models' },
  { to: '/projects', label: 'Projects', desc: 'Cost per initiative' },
  { to: '/analytics', label: 'Analytics', desc: 'ROI insights & reports' },
]

export default function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const moreActive = moreLinks.some((l) => location.pathname.startsWith(l.to))

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[75]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-[62px] left-3 right-3 bg-card border border-borderCard rounded-[16px] shadow-shell overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {moreLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col gap-[2px] px-5 py-[13px] border-b border-borderSubtle last:border-b-0 ${
                    isActive ? 'bg-navActive' : ''
                  }`
                }
              >
                <span className="text-textSecondary text-[15px] font-semibold">{l.label}</span>
                <span className="text-textMuted text-[12px] font-medium">{l.desc}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[74] bg-[#0e131c]/95 backdrop-blur border-t border-borderCard flex items-stretch pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-[3px] pt-[9px] pb-[7px] ${
                isActive ? 'text-[#7aa5ff]' : 'text-[#8b93a5]'
              }`
            }
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor">
              {t.icon}
            </svg>
            <span className="text-[10.5px] font-semibold">{t.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex-1 flex flex-col items-center justify-center gap-[3px] pt-[9px] pb-[7px] cursor-pointer ${
            moreOpen || moreActive ? 'text-[#7aa5ff]' : 'text-[#8b93a5]'
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor">
            <circle cx="5" cy="11" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="11" cy="11" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="17" cy="11" r="1.6" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-[10.5px] font-semibold">More</span>
        </button>
      </nav>
    </>
  )
}
