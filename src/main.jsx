import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// No <StrictMode>: App mounts a ported imperative canvas engine
// (src/legacy/voidEngine.js) that owns rAF loops, timers and window-level
// listeners. StrictMode's dev-only double-invoke of effects would mount it
// twice and briefly double every loop/listener before the first copy tears
// down — harmless in prod (StrictMode is a no-op there) but noisy in dev.
createRoot(document.getElementById('root')).render(<App />)
