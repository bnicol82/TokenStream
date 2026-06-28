import { Routes, Route } from 'react-router-dom'
import Overview from './pages/Overview'
import Chat from './pages/Chat'
import SpendTracking from './pages/SpendTracking'
import Optimization from './pages/Optimization'
import Budgets from './pages/Budgets'
import Analytics from './pages/Analytics'
import Projects from './pages/Projects'
import WelcomeModal from './components/WelcomeModal'

function App() {
  return (
    <>
      <WelcomeModal />
      <Routes>
      <Route path="/" element={<Overview />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/spend-tracking" element={<SpendTracking />} />
      <Route path="/optimization" element={<Optimization />} />
      <Route path="/budgets" element={<Budgets />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </>
  )
}

export default App
