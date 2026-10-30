// Browser gateway settings. The URL is baked in at build time: VITE_BROWSER_GATEWAY=ws://localhost:8788/browser
export const GATEWAY_URL = import.meta.env.VITE_BROWSER_GATEWAY || ''
export const VIEW = { width: 1100, height: 700 }

// Health of the gateway, read from its HTTP /health route next to the WebSocket.
// Returns { state: 'off' | 'online' | 'offline', sessions, max }.
export async function checkGateway(timeoutMs = 3000) {
  if (!GATEWAY_URL) return { state: 'off' }
  const http = GATEWAY_URL.replace(/^ws/, 'http').replace(/\/browser$/, '/health')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(http, { signal: ctrl.signal })
    if (!res.ok) return { state: 'offline' }
    const json = await res.json()
    return { state: 'online', sessions: json.sessions, max: json.max }
  } catch {
    return { state: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
