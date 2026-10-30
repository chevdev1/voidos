import { useEffect, useState } from 'react'
import { checkGateway, GATEWAY_URL } from './gateway.js'

// Shown on the browser start page. States are stated plainly, including what the site and the gateway can see.
export function ConnectionCard() {
  const [status, setStatus] = useState({ state: 'checking' })

  const refresh = () => {
    setStatus({ state: 'checking' })
    checkGateway().then(setStatus)
  }

  useEffect(refresh, [])

  const title = {
    checking: 'Checking connection…',
    off: 'Not connected',
    offline: 'Gateway offline',
    online: 'Connected to the browser gateway',
  }[status.state]

  const tone = status.state === 'online' ? 'os-tag-ok' : status.state === 'off' ? 'os-tag-warn' : 'os-tag-err'

  return (
    <div className="os-card os-stack os-conn">
      <div className="os-row os-between">
        <span className="os-label">Connection</span>
        <span className={`os-tag ${tone}`}>{status.state === 'online' ? 'live' : status.state === 'checking' ? '…' : 'not live'}</span>
      </div>
      <p className="os-title-sm">{title}</p>
      {status.state === 'online' && (
        <p className="os-muted os-small">
          The page is loaded on the gateway. The site sees the gateway's address, not yours. The gateway operator can see the pages you open. Sessions in use: {status.sessions} of {status.max}.
        </p>
      )}
      {status.state === 'off' && (
        <p className="os-muted os-small">
          This build has no browser gateway. Web addresses open in your own browser's tabs, and your address is visible to the sites you visit.
        </p>
      )}
      {status.state === 'offline' && (
        <p className="os-muted os-small">
          The gateway at {GATEWAY_URL.replace(/^ws/, 'http')} is not answering. Start it from the gateway folder with <code>npm start</code>, then retry.
        </p>
      )}
      {status.state !== 'off' && (
        <button className="os-btn" onClick={refresh} disabled={status.state === 'checking'}>Retry</button>
      )}
    </div>
  )
}
