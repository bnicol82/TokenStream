import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Top-level error boundary: an unexpected render error shows a recoverable
// screen instead of a blank page. "Reload" re-renders from persisted state.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TokenStream] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen w-full bg-page-bg flex items-center justify-center p-6">
        <div className="bg-card border border-borderCard rounded-[16px] p-[40px_32px] text-center max-w-[440px]">
          <div className="text-[40px] mb-3">⚠️</div>
          <div className="text-white text-[19px] font-extrabold tracking-[-0.3px] mb-[6px]">
            Something went wrong
          </div>
          <div className="text-textMuted text-[14px] font-medium leading-[1.55] mb-5">
            An unexpected error occurred. Your data is safe — reload to pick up where you left off.
          </div>
          <div className="text-textDim text-[12px] font-mono mb-5 break-words">
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary-gradient text-white text-sm font-bold px-[20px] py-[10px] rounded-[9px] cursor-pointer shadow-btnGlow"
          >
            Reload TokenStream
          </button>
        </div>
      </div>
    )
  }
}
