import { useMemo, useState } from 'react'
import { scorePassword } from './passwordScore.js'

// Defensive check for YOUR OWN network. Everything runs in this tab: the password is never sent or stored.
// It does not scan other networks and does not try to guess anything on a live network.
const CHECKLIST = [
  ['WPA3 or WPA2-AES', 'Never WEP, never WPA-TKIP.'],
  ['WPS turned off', 'The PIN method is a known weak point on many routers.'],
  ['Admin password changed', 'The default router login is public knowledge.'],
  ['Firmware updated', 'Enable automatic updates if the router offers them.'],
  ['Guest network for devices you do not trust', 'Keeps smart plugs and visitors off your main network.'],
  ['Remote admin off', 'Do not expose the router settings page to the internet.'],
]

export function WifiCheck() {
  const [pw, setPw] = useState('')
  const [shown, setShown] = useState(false)
  const [checked, setChecked] = useState({})
  const result = useMemo(() => scorePassword(pw), [pw])
  const done = Object.values(checked).filter(Boolean).length

  return (
    <div className="os-pad os-stack">
      <div className="os-card os-stack">
        <span className="os-label">Your Wi-Fi password</span>
        <div className="os-row">
          <input
            className="os-input os-mono"
            type={shown ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="type it here, it stays on this device"
            autoComplete="off"
            spellCheck={false}
            aria-label="Wi-Fi password to check"
          />
          <button className="os-btn" type="button" onClick={() => setShown((v) => !v)}>{shown ? 'Hide' : 'Show'}</button>
        </div>
        <div className="os-bar os-strength" data-score={result.score}>
          <i style={{ width: `${(result.score / 4) * 100}%` }} />
        </div>
        <div className="os-row os-between">
          <span className="os-muted os-small">strength</span>
          <span className="os-mono">{result.label}</span>
        </div>
        {result.tips.map((t) => (
          <p key={t} className="os-note">{t}</p>
        ))}
      </div>

      <div className="os-card os-stack">
        <div className="os-row os-between">
          <span className="os-label">Router checklist</span>
          <span className="os-mono os-small">{done}/{CHECKLIST.length}</span>
        </div>
        {CHECKLIST.map(([title, why]) => (
          <label key={title} className="os-check">
            <input
              type="checkbox"
              checked={Boolean(checked[title])}
              onChange={(e) => setChecked((c) => ({ ...c, [title]: e.target.checked }))}
            />
            <span>
              <b>{title}</b>
              <span className="os-muted os-small">{why}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="os-note">
        This checks your own password and settings. It does not scan networks or test anyone else's access.
      </p>
    </div>
  )
}
