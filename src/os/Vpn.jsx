import { useEffect, useRef, useState } from 'react'
import { setProtection, getProtection } from './protection.js'

// Simulated tunnel. Endpoints use the RFC 5737 documentation range, so nothing here is a real server.
const SERVERS = [
  { id: 'nl', name: 'Amsterdam', cc: 'NL', endpoint: '203.0.113.21:51820', ping: 24 },
  { id: 'ch', name: 'Zurich', cc: 'CH', endpoint: '203.0.113.47:51820', ping: 31 },
  { id: 'is', name: 'Reykjavik', cc: 'IS', endpoint: '198.51.100.9:51820', ping: 58 },
  { id: 'sg', name: 'Singapore', cc: 'SG', endpoint: '198.51.100.73:51820', ping: 186 },
]
const PROTOCOLS = [
  { id: 'wg', name: 'WireGuard', note: 'fast · single hop' },
  { id: 'dh', name: 'Double hop', note: 'two servers in sequence' },
  { id: 'tor', name: 'Tor · 3 hops', note: 'simulated circuit' },
]
const STAGES = [
  'generating ephemeral keys',
  'handshake with endpoint',
  'installing routes',
  'DNS leak guard on',
  'kill-switch armed',
]
const SPARK_POINTS = 48

const fmtTime = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}
const fmtMb = (n) => (n < 1024 ? `${n.toFixed(1)} MB` : `${(n / 1024).toFixed(2)} GB`)

export function Vpn({ payload }) {
  const [server, setServer] = useState(SERVERS[0])
  const [proto, setProto] = useState(PROTOCOLS[0])
  const [phase, setPhase] = useState('off') // off | connecting | on
  const [stage, setStage] = useState(0)
  const [uptime, setUptime] = useState(0)
  const [traffic, setTraffic] = useState({ down: 0, up: 0 })
  const [spark, setSpark] = useState(() => Array.from({ length: SPARK_POINTS }, () => 0.4))
  const [killSwitch, setKillSwitch] = useState(true)
  const timers = useRef([])

  // Publish the state so the browser can warn when nothing protects the session.
  useEffect(() => {
    if (phase === 'on') setProtection('vpn')
    else if (phase === 'connecting') setProtection('connecting')
    else if (getProtection() === 'vpn' || getProtection() === 'connecting') setProtection('off')
  }, [phase])
  useEffect(() => () => {
    if (getProtection() === 'vpn' || getProtection() === 'connecting') setProtection('off')
  }, [])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  function connect() {
    if (phase !== 'off') return
    setPhase('connecting')
    setStage(0)
    STAGES.forEach((_, i) => later(() => setStage(i + 1), 520 + i * 620))
    later(() => {
      setPhase('on')
      setUptime(0)
    }, 520 + STAGES.length * 620)
  }

  function disconnect() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase('off')
    setStage(0)
    setUptime(0)
    setTraffic({ down: 0, up: 0 })
  }

  // Opened from Terminal with `vpn on`.
  useEffect(() => {
    if (payload?.want === 'on') connect()
    if (payload?.want === 'off') disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.nonce])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Live numbers only while connected.
  useEffect(() => {
    if (phase !== 'on') return undefined
    const id = setInterval(() => {
      setUptime((u) => u + 1)
      const down = 0.4 + Math.random() * 1.8
      const up = 0.05 + Math.random() * 0.35
      setTraffic((t) => ({ down: t.down + down, up: t.up + up }))
      setSpark((s) => [...s.slice(1), Math.max(0.08, Math.min(1, (s[s.length - 1] + (Math.random() - 0.5) * 0.5)))])
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  const points = spark.map((v, i) => `${(i / (SPARK_POINTS - 1)) * 100},${(1 - v) * 100}`).join(' ')
  const statusText = phase === 'on' ? 'connected' : phase === 'connecting' ? 'connecting' : 'not connected'
  const locked = phase !== 'off'

  return (
    <div className={`os-pad os-vpn os-vpn-${phase}`}>
      <div className="os-vpn-head">
        <div className="os-vpn-orb" aria-hidden="true">
          <span className="os-vpn-ring" />
          <span className="os-vpn-core">{phase === 'on' ? '●' : phase === 'connecting' ? '◌' : '○'}</span>
        </div>
        <div className="os-stack-tight">
          <span className="os-label">Tunnel</span>
          <span className="os-vpn-status">{statusText}</span>
          <span className="os-muted os-small">{phase === 'on' ? `${server.name}, ${server.cc} · ${proto.name}` : 'choose a server, then connect'}</span>
        </div>
      </div>

      {phase === 'connecting' && (
        <ol className="os-vpn-stages" aria-live="polite">
          {STAGES.map((s, i) => (
            <li key={s} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
              <span>{i < stage ? '✓' : i === stage ? '›' : '·'}</span> {s}
            </li>
          ))}
        </ol>
      )}

      {phase !== 'on' && (
        <>
          <div className="os-vpn-section">
            <span className="os-label">Server</span>
            <div className="os-vpn-grid">
              {SERVERS.map((s) => (
                <button
                  key={s.id}
                  className={`os-vpn-pick ${server.id === s.id ? 'is-on' : ''}`}
                  onClick={() => setServer(s)}
                  disabled={locked}
                >
                  <b>{s.cc}</b> {s.name}
                  <span className="os-muted">{s.ping} ms</span>
                </button>
              ))}
            </div>
          </div>
          <div className="os-vpn-section">
            <span className="os-label">Protocol</span>
            <div className="os-seg">
              {PROTOCOLS.map((p) => (
                <button key={p.id} className={proto.id === p.id ? 'is-on' : ''} onClick={() => setProto(p)} disabled={locked}>
                  {p.name}
                </button>
              ))}
            </div>
            <span className="os-note">{proto.note}</span>
          </div>
          <button className="os-btn os-btn-primary os-vpn-cta" onClick={connect} disabled={locked}>
            {locked ? 'Connecting…' : 'Connect'}
          </button>
        </>
      )}

      {phase === 'on' && (
        <div className="os-vpn-live">
          <svg className="os-vpn-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Simulated throughput">
            <polyline points={points} fill="none" stroke="#ccff00" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="os-vpn-stats">
            <div><span className="os-label">Uptime</span><b className="os-mono">{fmtTime(uptime)}</b></div>
            <div><span className="os-label">Latency</span><b className="os-mono">{server.ping} ms</b></div>
            <div><span className="os-label">Down</span><b className="os-mono">{fmtMb(traffic.down)}</b></div>
            <div><span className="os-label">Up</span><b className="os-mono">{fmtMb(traffic.up)}</b></div>
          </div>
          <div className="os-kv"><span>Endpoint</span><span className="os-mono">{server.endpoint}</span></div>
          <div className="os-kv"><span>Tunnel address</span><span className="os-mono">10.66.0.2</span></div>
          <div className="os-kv"><span>DNS</span><span>via tunnel · leak guard on</span></div>
          <label className="os-vpn-toggle">
            <input type="checkbox" checked={killSwitch} onChange={(e) => setKillSwitch(e.target.checked)} />
            kill-switch: block traffic if the tunnel drops
          </label>
          <button className="os-btn os-vpn-cta" onClick={disconnect}>Disconnect</button>
        </div>
      )}

      <p className="os-note">Simulated in this build. The tunnel is not real and your IP is not hidden here.</p>
    </div>
  )
}
