import { useEffect, useRef, useState } from 'react'
import { useProtection, isProtected } from './protection.js'

const CHECK_STEPS = ['reading tunnel state', 'checking DNS path', 'checking exposed address']
const SSH_HOST = 'lab-01.void.test'

// Shown at the top of the browser while nothing protects the session.
// Yellow with two ways out (VPN or an SSH session), then a check the user can run.
export function ProtectionBanner({ onOpen }) {
  const level = useProtection()
  const [checking, setChecking] = useState(-1) // index into CHECK_STEPS, -1 = idle
  const [result, setResult] = useState(null) // null | 'protected' | 'still-open'
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Protection can also change by itself, so drop a stale result when it does.
  useEffect(() => {
    if (isProtected(level)) setResult('protected')
    else setResult((r) => (r === 'protected' ? null : r))
  }, [level])

  function runCheck() {
    if (checking >= 0) return
    setResult(null)
    CHECK_STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setChecking(i), 320 * i)))
    timers.current.push(
      setTimeout(() => {
        setChecking(-1)
        setResult(isProtected() ? 'protected' : 'still-open')
      }, 320 * CHECK_STEPS.length + 200),
    )
  }

  if (result === 'protected' || (isProtected(level) && checking < 0)) {
    return (
      <div className="os-protect is-ok" role="status">
        <span className="os-protect-dot" aria-hidden="true" />
        <span>
          <b>Protected</b> · {level === 'ssh' ? 'SSH session' : 'VPN'} (simulated)
        </span>
      </div>
    )
  }

  return (
    <div className="os-protect is-open" role="alert">
      <div className="os-protect-text">
        <b>You are not protected!</b>
        <span>
          Websites can see your real address. Turn on the VPN, or connect over SSH, then check again.
        </span>
        {result === 'still-open' && <span className="os-protect-still">Still open. Nothing is protecting this session yet.</span>}
        {checking >= 0 && (
          <span className="os-protect-steps" aria-live="polite">
            {CHECK_STEPS.slice(0, checking + 1).map((s, i) => (
              <span key={s}>{i < checking ? '✓' : '›'} {s}</span>
            ))}
          </span>
        )}
      </div>
      <div className="os-protect-actions">
        <button className="os-protect-btn" onClick={() => onOpen('vpn', { want: 'on', nonce: Date.now() })}>Turn on VPN</button>
        <button className="os-protect-btn" onClick={() => onOpen('terminal', { ssh: SSH_HOST, nonce: Date.now() })}>Connect over SSH</button>
        <button className="os-protect-btn is-ghost" onClick={runCheck} disabled={checking >= 0}>
          {checking >= 0 ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </div>
  )
}
