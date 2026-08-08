import { HashRouter, BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Documentation from './pages/Documentation'

// Prefer BrowserRouter on hosts with SPA rewrites (Vercel). Hash fallback if
// opened as a file:// or when VITE_HASH_ROUTER=1.
const useHash =
  import.meta.env.VITE_HASH_ROUTER === '1' ||
  (typeof location !== 'undefined' && location.protocol === 'file:')
const Router = useHash ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<Documentation />} />
      </Routes>
    </Router>
  )
}
