import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function killHtmlBoot() {
  try {
    window.dispatchEvent(new Event('void-boot-html-off'))
  } catch {
    /* ignore */
  }
  const el = document.getElementById('boot-html')
  if (el) el.remove()
}

killHtmlBoot()

try {
  createRoot(document.getElementById('root')).render(<App />)
} catch (err) {
  console.error('[void] render failed', err)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML =
      '<p style="padding:24px;color:#ccff00;font-family:monospace">VOID.OS failed to start. Close Trust tabs and refresh.</p>'
  }
}

killHtmlBoot()
