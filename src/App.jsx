import { HashRouter, BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Documentation from './pages/Documentation'
import Cabinet from './pages/Cabinet'
import MapPage from './pages/MapPage'
import Board from './pages/Board'

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
      </Routes>
    </Router>
  )
}
