import { useState } from 'react'
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

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex items-center px-[30px] py-[22px] border-b border-borderSubtle max-md:px-4 max-md:py-[14px]">
      {/* Hamburger — replaces the inline nav on narrow screens */}
      <button
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        className="hidden max-xl:flex w-[38px] h-[38px] mr-3 rounded-[9px] border border-borderInput items-center justify-center cursor-pointer hover:border-white/20"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="#c4cad6" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      <Logo />

      <nav className="flex items-center gap-[6px] ml-[14px] max-xl:hidden">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
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
      </nav>

      <div className="ml-auto flex items-center gap-3 max-md:gap-2">
        <WorkspaceSwitcher />
        <NotificationBell />
        <Account />
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] hidden max-xl:block" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 left-0 right-0 bg-card border-b border-borderCard shadow-shell p-4 pb-5">
            <div className="flex items-center justify-between mb-3">
              <Logo />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="w-[38px] h-[38px] rounded-[9px] border border-borderInput flex items-center justify-center cursor-pointer hover:border-white/20"
              >
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="#c4cad6" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-[12px] rounded-[10px] text-[16px] transition-colors ${
                      isActive
                        ? 'bg-navActive text-white font-semibold'
                        : 'text-[#9aa3b5] font-medium hover:text-white'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
