export default function Logo() {
  return (
    <div className="flex items-center gap-[11px]">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          d="M14 2L24 8V20L14 26L4 20V8L14 2Z"
          stroke="#3770f0"
          strokeWidth="1.8"
          fill="rgba(23,77,204,.18)"
        />
        <path
          d="M14 8.5L19 11.5V17.5L14 20.5L9 17.5V11.5L14 8.5Z"
          stroke="#5580f8"
          strokeWidth="1.6"
        />
      </svg>
      <span className="text-[22px] font-bold tracking-[-0.3px] text-[#f3f5fa]">
        TokenStream
      </span>
    </div>
  )
}
