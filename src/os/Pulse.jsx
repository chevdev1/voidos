import { useEffect, useState } from 'react'
import { RH_CHAIN, toRow } from './lib.js'

const MAX = 28
const POLL_MS = 2500

async function rpc(method, params = []) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(RH_CHAIN.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error.message)
    return json.result
  } finally {
    clearTimeout(timer)
  }
}

function ago(ms, now) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
}

function Spark({ values }) {
  if (values.length < 2) return <div className="os-spark-empty">collecting blocks…</div>
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 88 - 6}`).join(' ')
  return (
    <svg className="os-pulse-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Transactions per block">
      <polyline points={pts} fill="none" stroke="#ccff00" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Pulse() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('connecting')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    let last = 0
    const tick = async () => {
      try {
        const head = Number.parseInt(await rpc('eth_blockNumber'), 16)
        if (!alive) return
        if (head === last) {
          setStatus('live')
          return
        }
        // Fetch only the blocks we have not seen yet (capped, so a long pause does not flood the RPC).
        const from = last ? Math.max(last + 1, head - 5) : head
        const nums = []
        for (let n = from; n <= head; n++) nums.push(n)
        const blocks = await Promise.all(
          nums.map((n) => rpc('eth_getBlockByNumber', ['0x' + n.toString(16), false]).catch(() => null)),
        )
        if (!alive) return
        const fresh = blocks.filter(Boolean).map(toRow)
        setRows((r) => [...fresh.reverse(), ...r].slice(0, MAX))
        last = head
        setStatus('live')
      } catch {
        if (alive) setStatus('unreachable')
      }
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      alive = false
      clearInterval(id)
      clearInterval(clock)
    }
  }, [])

  const chrono = [...rows].reverse()
  const totalTx = rows.reduce((a, r) => a + r.txs, 0)

  return (
    <div className="os-pad os-stack">
      <div className="os-row os-between">
        <div>
          <div className="os-title-sm">Pulse · {RH_CHAIN.name}</div>
          <div className="os-muted os-small">new blocks as they land</div>
        </div>
        <span className={`os-tag ${status === 'live' ? 'os-tag-ok' : status === 'unreachable' ? 'os-tag-err' : ''}`}>
          {status}
        </span>
      </div>

      <div className="os-card os-stack">
        <span className="os-label">Transactions per block</span>
        <Spark values={chrono.map((r) => r.txs)} />
        <div className="os-row os-between os-small">
          <span className="os-muted">last {rows.length} blocks</span>
          <span className="os-mono">{totalTx} tx</span>
        </div>
      </div>

      {status === 'unreachable' && (
        <p className="os-error">RPC is not answering from this browser. Try again in a minute.</p>
      )}

      <div className="os-table" role="table" aria-label="Recent blocks">
        <div className="os-tr os-th" role="row" style={{ gridTemplateColumns: '1.1fr 0.6fr 0.8fr 1fr' }}>
          <span>Block</span><span>Txs</span><span>Gas used</span><span>Seen</span>
        </div>
        {rows.slice(0, 12).map((r) => (
          <a
            key={r.num}
            className="os-tr os-pulse-row"
            role="row"
            href={`${RH_CHAIN.explorer}/block/${r.num}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ gridTemplateColumns: '1.1fr 0.6fr 0.8fr 1fr' }}
          >
            <span className="os-mono">#{r.num.toLocaleString('en-US')}</span>
            <span className="os-mono">{r.txs}</span>
            <span className="os-mono" title={`${r.gasPct}% of block gas limit`}>{r.gasUsed.toLocaleString('en-US')}</span>
            <span className="os-muted">{ago(r.time, now)}</span>
          </a>
        ))}
        {!rows.length && <div className="os-tr os-muted" role="row">waiting for the first block…</div>}
      </div>
      <p className="os-note">Public RPC data. Click a block to open it in the explorer.</p>
    </div>
  )
}
