import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app-context'

const WELCOMED_KEY = 'tokenstream:welcomed'

const steps = [
  {
    emoji: '💬',
    title: 'Chat for less, automatically',
    body: 'Ask anything — TokenStream routes each message to the cheapest model that can do the job (free models by default) and shows the cost before you send. You can pin a specific model anytime.',
  },
  {
    emoji: '📊',
    title: 'See where every token goes',
    body: 'Spend Tracking and Analytics break down your AI cost by provider, model, and project — with savings vs. running everything on a frontier model.',
  },
  {
    emoji: '🗂️',
    title: 'Track cost per project',
    body: 'Group usage into projects (auto-assigned by keywords or set manually) so you know exactly what each initiative costs in AI.',
  },
  {
    emoji: '🔔',
    title: 'Budgets & alerts, your keys',
    body: 'Set budgets (overall or per project) and get notified before you blow past them. Connect your own provider API keys anytime to use your own quota.',
  },
]

export default function WelcomeModal() {
  const { session, syncing, data } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOMED_KEY) === '1'
    } catch {
      return false
    }
  })

  // Show only for a signed-in, freshly-empty account that hasn't seen it yet.
  const isEmptyNewAccount =
    !!session && !syncing && data.conversations.length === 0 && data.transactions.length === 0
  if (dismissed || !isEmptyNewAccount) return null

  const finish = (goToChat: boolean) => {
    try {
      localStorage.setItem(WELCOMED_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
    if (goToChat) navigate('/chat')
  }

  const s = steps[step]
  const last = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div className="bg-card border border-borderCard rounded-[18px] w-full max-w-[460px] p-[30px] shadow-shell">
        <div className="flex items-start justify-between mb-1">
          <div className="text-textMuted text-[12px] font-bold tracking-[0.6px] uppercase">
            Welcome to TokenStream
          </div>
          <button onClick={() => finish(false)} className="text-textMuted text-[20px] leading-none cursor-pointer hover:text-white">
            ×
          </button>
        </div>

        <div className="text-[44px] mt-3 mb-2">{s.emoji}</div>
        <div className="text-white text-[22px] font-extrabold tracking-[-0.4px] mb-2">{s.title}</div>
        <div className="text-textTertiary text-[14.5px] font-medium leading-[1.55] min-h-[88px]">{s.body}</div>

        <div className="flex items-center gap-[6px] mt-5 mb-5">
          {steps.map((_, i) => (
            <span
              key={i}
              className="h-[6px] rounded-[3px] transition-all"
              style={{ width: i === step ? 22 : 6, background: i === step ? '#5b8dff' : '#2a3344' }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? finish(false) : setStep(step - 1))}
            className="text-[#aab2c2] text-sm font-semibold px-4 py-[10px] rounded-[9px] border border-borderInput cursor-pointer hover:text-white"
          >
            {step === 0 ? 'Skip' : 'Back'}
          </button>
          <button
            onClick={() => (last ? finish(true) : setStep(step + 1))}
            className="bg-primary-gradient text-white text-sm font-bold px-[20px] py-[10px] rounded-[9px] cursor-pointer shadow-btnGlow"
          >
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
