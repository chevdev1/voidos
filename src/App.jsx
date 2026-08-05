import { HashRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Documentation from './pages/Documentation'

// HashRouter (not BrowserRouter): the deploy target for this repo isn't
// known, and a plain static host without SPA rewrite rules would 404 on a
// hard refresh of /docs under BrowserRouter. Hash routing needs zero
// server config anywhere. Swap to BrowserRouter later if this ends up on
// Vercel/Netlify (or anything else that rewrites all paths to index.html).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<Documentation />} />
      </Routes>
    </HashRouter>
  )
}
