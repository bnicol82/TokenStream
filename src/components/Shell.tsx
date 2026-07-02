import type { ReactNode } from 'react'
import TopNav from './TopNav'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-page-bg flex items-start justify-center p-0 md:p-6 lg:p-[40px_24px]">
      <div className="w-full max-w-[1180px] bg-app md:rounded-[22px] border-0 md:border border-[rgba(255,255,255,.04)] overflow-hidden md:shadow-shell min-h-screen md:min-h-0">
        <TopNav />
        {children}
      </div>
    </div>
  )
}
