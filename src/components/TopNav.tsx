import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from './Logo'
import Account from './Account'
import NotificationBell from './NotificationBell'
import WorkspaceSwitcher from './WorkspaceSwitcher'

const links = [
  { to: '/chat', label: 'Chat' },
  { to: '/', label: 'Overview' },
  { to: '/spend-tracking', label: 'Spend Tracking' },
  { to: '/optimization', label: 'Optimization' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/projects', label: 'Projects' },
  { to: '/analytics', label: 'Analytics', chevron: true },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-1 px-4 py-[9px] rounded-[9px] text-[15.5px] transition-colors ${
              isActive
                ? 'bg-navActive text-white font-semibold'
                : 'text-[#9aa3b5] font-medium hover:text-white'
            }`
          }
        >
          {l.label}
          {l.chevron && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </NavLink>
      ))}
    </>
  )
}

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 md:px-[30px] md:py-[22px] border-b border-borderSubtle">
        <Logo />

        <nav className="hidden lg:flex items-center gap-[6px] ml-[14px] min-w-0">
          <NavLinks />
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
          <WorkspaceSwitcher />
          <NotificationBell />
          <Account />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-[9px] border border-borderInput text-[#aab2c2] hover:text-white hover:border-white/20 transition-colors"
            aria-label="Open navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute top-0 right-0 h-full w-[min(320px,88vw)] bg-app border-l border-borderSubtle shadow-shell flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-borderSubtle">
              <span className="text-white text-[16px] font-bold">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 rounded-[9px] flex items-center justify-center text-textMuted hover:text-white hover:bg-[rgba(255,255,255,.06)]"
                aria-label="Close navigation menu"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3 overflow-y-auto">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
