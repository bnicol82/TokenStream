import type { ReactNode } from 'react'
import TopNav from './TopNav'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-page-bg flex items-start justify-center p-[40px_24px] max-md:p-0">
      <div className="w-full max-w-[1180px] bg-app rounded-[22px] border border-[rgba(255,255,255,.04)] overflow-hidden shadow-shell max-md:min-h-screen max-md:rounded-none max-md:border-0">
        <TopNav />
        {children}
      </div>
    </div>
  )
}
