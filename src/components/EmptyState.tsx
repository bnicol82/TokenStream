// Friendly empty-state prompt for pages with no data yet (new accounts). Guides
// the user to the next useful action instead of showing a bare $0 dashboard.
export default function EmptyState({
  emoji,
  title,
  body,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
}: {
  emoji: string
  title: string
  body: string
  ctaLabel?: string
  onCta?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  return (
    <div className="bg-card border border-borderCard rounded-[16px] p-[40px_28px] text-center flex flex-col items-center">
      <div className="text-[40px] mb-3">{emoji}</div>
      <div className="text-white text-[19px] font-extrabold tracking-[-0.3px] mb-[6px]">{title}</div>
      <div className="text-textMuted text-[14px] font-medium leading-[1.55] max-w-[420px] mb-5">{body}</div>
      <div className="flex items-center gap-[10px]">
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            className="bg-primary-gradient text-white text-sm font-bold px-[20px] py-[10px] rounded-[9px] cursor-pointer shadow-btnGlow"
          >
            {ctaLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="text-[#aab2c2] text-sm font-semibold px-[18px] py-[10px] rounded-[9px] border border-borderInput cursor-pointer hover:text-white"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
