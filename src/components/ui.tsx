import type { ReactNode } from 'react'

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`bg-card border border-borderCard rounded-[14px] ${className}`}
    >
      {children}
    </div>
  )
}

export function Toggle({
  on,
  onClick,
  activeColor = '#5b8dff',
}: {
  on: boolean
  onClick: () => void
  activeColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[40px] h-[23px] rounded-[99px] relative transition-colors shrink-0"
      style={{ background: on ? activeColor : '#222a38' }}
    >
      <span
        className="absolute top-[2px] w-[19px] h-[19px] rounded-full bg-white transition-all"
        style={{ left: on ? '18px' : '2px' }}
      />
    </button>
  )
}

export function ProgressBar({
  pct,
  height = 11,
  gradient = 'linear-gradient(90deg,#3f6fe0,#6a9bff)',
  track = '#1d2532',
}: {
  pct: number
  height?: number
  gradient?: string
  track?: string
}) {
  return (
    <div
      className="w-full rounded-[99px] overflow-hidden"
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-[99px]"
        style={{ width: `${Math.min(pct, 100)}%`, background: gradient }}
      />
    </div>
  )
}

export function SegmentBar({
  filled,
  total = 9,
  color = '#5b8dff',
}: {
  filled: number
  total?: number
  color?: string
}) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] w-[10px] rounded-[2px]"
          style={{ background: i < filled ? color : '#222a38' }}
        />
      ))}
    </div>
  )
}

export function Tag({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[13.5px] font-semibold bg-[#1d2532] text-[#bcc4d2] ${className}`}
    >
      {children}
    </span>
  )
}

export function PrimaryButton({
  children,
  onClick,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`bg-primary-gradient text-white font-bold rounded-[9px] shadow-btnGlow transition-opacity hover:opacity-90 ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[#aab2c2] border border-borderInput rounded-[9px] hover:text-white hover:border-white/20 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#2bb673" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
