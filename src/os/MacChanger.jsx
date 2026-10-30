import { useEffect, useRef, useState } from 'react'
import { isValidMac, randomMac } from './mac.js'

// Simulated interface list. Nothing here touches the real network stack.
const IFACES = [
  { id: 'wifi', name: 'Wi-Fi', dev: 'en0', mac: '3c:22:fb:9e:41:07', hw: '3c:22:fb:9e:41:07' },
  { id: 'eth', name: 'Ethernet', dev: 'en1', mac: 'a4:83:e7:12:0b:5c', hw: 'a4:83:e7:12:0b:5c' },
  { id: 'tun', name: 'Tunnel (sim)', dev: 'utun3', mac: '00:00:00:00:00:00', hw: '00:00:00:00:00:00', virtual: true },
]

const STEPS = ['interface down', 'writing address', 'interface up', 'renewing lease (sim)']

export function MacChanger() {
  const [ifaces, setIfaces] = useState(IFACES)
  const [selected, setSelected] = useState('wifi')
  const [draft, setDraft] = useState(IFACES[0].mac)
  const [step, setStep] = useState(-1)
  const [log, setLog] = useState([])
  const timers = useRef([])

  const iface = ifaces.find((i) => i.id === selected)
  const busy = step >= 0
  const valid = isValidMac(draft)

  useEffect(() => {
    setDraft(iface.mac)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function apply(newMac) {
    if (busy || iface.virtual) return
    const mac = newMac.toLowerCase()
    setLog((l) => [`${iface.dev}: request ${mac}`, ...l].slice(0, 8))
    setStep(0)
    STEPS.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setStep(i + 1)
          setLog((l) => [`${iface.dev}: ${s}…`, ...l].slice(0, 8))
        }, 500 + i * 650),
      )
    })
    timers.current.push(
      setTimeout(() => {
        setIfaces((list) => list.map((x) => (x.id === iface.id ? { ...x, mac } : x)))
        setDraft(mac)
        setStep(-1)
        setLog((l) => [`${iface.dev}: active as ${mac} (sim)`, ...l].slice(0, 8))
      }, 500 + STEPS.length * 650),
    )
  }

  function restore() {
    apply(iface.hw)
  }

  const progress = step < 0 ? 0 : Math.min(100, (step / STEPS.length) * 100)

  return (
    <div className="os-pad os-stack">
      <div className="os-row">
        {ifaces.map((i) => (
          <button key={i.id} className={`os-chip ${selected === i.id ? 'is-on' : ''}`} onClick={() => setSelected(i.id)} disabled={busy}>
            {i.name} · {i.dev}
          </button>
        ))}
      </div>

      <div className="os-card os-stack">
        <div className="os-row os-between">
          <span className="os-label">Current MAC</span>
          <span className={`os-tag ${iface.mac === iface.hw ? '' : 'os-tag-ok'}`}>
            {iface.mac === iface.hw ? 'hardware' : 'spoofed (sim)'}
          </span>
        </div>
        <div className="os-big os-mono os-mac">{iface.mac}</div>
        <div className="os-muted os-small">hardware: <span className="os-mono">{iface.hw}</span></div>
      </div>

      <div className="os-card os-stack">
        <span className="os-label">New address</span>
        <div className="os-row">
          <input
            className="os-input os-mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="MAC address"
            aria-invalid={!valid}
            disabled={busy || iface.virtual}
          />
          <button className="os-btn" onClick={() => setDraft(randomMac())} disabled={busy || iface.virtual}>Random</button>
        </div>
        {!valid && <p className="os-error">Format: six pairs of hex digits, e.g. 02:1a:4f:33:9b:c0</p>}
        <div className="os-row">
          <button className="os-btn os-btn-primary" onClick={() => apply(draft)} disabled={busy || !valid || iface.virtual}>
            Apply
          </button>
          <button className="os-btn" onClick={restore} disabled={busy || iface.mac === iface.hw || iface.virtual}>
            Restore hardware
          </button>
        </div>
        {iface.virtual && <p className="os-note">Virtual interfaces have no burned-in address to change.</p>}
      </div>

      {busy && (
        <div className="os-card os-stack" aria-live="polite">
          <div className="os-bar"><i style={{ width: `${progress}%` }} /></div>
          <ol className="os-vpn-stages">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
                <span>{i < step ? '✓' : i === step ? '›' : '·'}</span> {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="os-card os-stack">
        <span className="os-label">Log</span>
        <div className="os-mono os-small os-log">
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div className="os-muted">no changes yet</div>}
        </div>
      </div>

      <p className="os-note">
        Simulated. Changing a real MAC needs the native build with system permissions. This page cannot touch your network card.
      </p>
    </div>
  )
}
