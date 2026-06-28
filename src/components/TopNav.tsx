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
  return (
    <div className="flex items-center px-[30px] py-[22px] border-b border-borderSubtle">
      <Logo />
      <nav className="flex items-center gap-[6px] ml-[14px]">
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
      <div className="ml-auto flex items-center gap-3">
        <WorkspaceSwitcher />
        <NotificationBell />
        <Account />
      </div>
    </div>
  )
}
