import { lazy, Suspense } from 'react'
import { HashRouter, BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Documentation from './pages/Documentation'
import Cabinet from './pages/Cabinet'
import MapPage from './pages/MapPage'
import Board from './pages/Board'

// VOID.OS demo opens in a new tab from the landing; keep it out of the landing bundle.
const OsDemo = lazy(() => import('./os/OsDemo.jsx'))

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
        <Route path="/cabinet" element={<Cabinet />} />
        <Route path="/board" element={<Board />} />
        <Route path="/map" element={<MapPage />} />
        <Route
          path="/os"
          element={
            <Suspense fallback={null}>
              <OsDemo />
            </Suspense>
          }
        />
      </Routes>
    </Router>
  )
}
