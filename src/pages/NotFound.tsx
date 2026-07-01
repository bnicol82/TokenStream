import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import EmptyState from '../components/EmptyState'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Shell>
      <div className="px-[30px] py-[60px]">
        <EmptyState
          emoji="🧭"
          title="Page not found"
          body="That page doesn't exist. Head back to the dashboard to see your spend, savings, and budgets."
          ctaLabel="Back to Overview"
          onCta={() => navigate('/')}
          secondaryLabel="Open Chat"
          onSecondary={() => navigate('/chat')}
        />
      </div>
    </Shell>
  )
}
