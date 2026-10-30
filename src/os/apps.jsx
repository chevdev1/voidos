import { useEffect, useState } from 'react'
import {
  RH_CHAIN,
  classifyInput,
  explorerUrl,
  shortHex,
} from './lib.js'
import { useTokenImage } from './tokenImage.js'

// ---------- shared bits ----------

const Tag = ({ tone = 'muted', children }) => <span className={`os-tag os-tag-${tone}`}>{children}</span>

// Logo loads lazily from GeckoTerminal; until it arrives (or if it never does) show the symbol's initial.
export function TokenLogo({ address, symbol }) {
  const src = useTokenImage(address)
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <span className="os-logo os-logo-fallback" aria-hidden="true">{(symbol || '?').slice(0, 1)}</span>
  }
  return (
    <img
      className="os-logo"
      src={src}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

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
    if (json.error) throw new Error(json.error.message || 'rpc error')
    return json.result
  } finally {
    clearTimeout(timer)
  }
}

const weiToEth = (hex) => (Number(BigInt(hex)) / 1e18).toFixed(6)

// ---------- Welcome ----------

export function WelcomeApp({ onOpen }) {
  return (
    <div className="os-pad os-stack">
      <p className="os-eyebrow">VOID.OS · demo build</p>
      <h2 className="os-title">Anonymous crypto desktop.</h2>
      <p className="os-muted">
        This is a front-end preview of the real system. Nothing here asks for keys, seed phrases or passwords.
        Tor is simulated in this build.
      </p>
      <ol className="os-steps">
        <li>Connect a browser wallet, or paste a public address to view it read-only.</li>
        <li>Check what is trending on Robinhood Chain.</li>
        <li>Paste any address, token or transaction into Inspector.</li>
      </ol>
      <div className="os-row">
        <button className="os-btn os-btn-primary" onClick={() => onOpen('wallet')}>Open Wallet</button>
        <button className="os-btn" onClick={() => onOpen('market')}>Open Market</button>
        <button className="os-btn" onClick={() => onOpen('inspector')}>Open Inspector</button>
      </div>
    </div>
  )
}

// ---------- Wallet ----------

export function WalletApp() {
  const [status, setStatus] = useState('idle')
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [manualBalance, setManualBalance] = useState(null)

  const hasProvider = typeof window !== 'undefined' && Boolean(window.ethereum)

  async function connect() {
    setError('')
    if (!window.ethereum) {
      setError('No browser wallet found. Install MetaMask, Rabby or Trust, or use the read-only field below.')
      return
    }
    setStatus('connecting')
    try {
      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const cid = await window.ethereum.request({ method: 'eth_chainId' })
      const bal = await window.ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] })
      setAccount(addr)
      setChainId(cid)
      setBalance(weiToEth(bal))
      setStatus('connected')
    } catch (e) {
      setError(e?.message || 'Connection was cancelled.')
      setStatus('idle')
    }
  }

  function disconnect() {
    setAccount('')
    setChainId('')
    setBalance('')
    setStatus('idle')
  }

  async function lookup(e) {
    e.preventDefault()
    const item = classifyInput(manual)
    setManualBalance(null)
    if (item.kind !== 'address') {
      setManualBalance({ error: 'Enter a 0x address (40 hex characters).' })
      return
    }
    try {
      const bal = await rpc('eth_getBalance', [item.value, 'latest'])
      setManualBalance({ address: item.value, eth: weiToEth(bal) })
    } catch {
      setManualBalance({ address: item.value, error: 'RPC is unreachable right now. Try again later.' })
    }
  }

  const onChain = chainId && Number.parseInt(chainId, 16) === RH_CHAIN.id

  return (
    <div className="os-pad os-stack">
      <div className="os-card">
        <div className="os-row os-between">
          <span className="os-label">Status</span>
          <Tag tone={status === 'connected' ? 'ok' : 'muted'}>{status === 'connected' ? 'connected' : 'not connected'}</Tag>
        </div>

        {status === 'connected' ? (
          <>
            <div className="os-big">{balance} ETH</div>
            <div className="os-muted os-mono">{shortHex(account)}</div>
            <div className="os-row os-between">
              <Tag tone={onChain ? 'ok' : 'warn'}>{onChain ? 'Robinhood Chain' : `chain ${Number.parseInt(chainId, 16)}`}</Tag>
              <button className="os-btn" onClick={disconnect}>Disconnect</button>
            </div>
          </>
        ) : (
          <>
            <p className="os-muted">Connect with your own wallet. The desktop never sees your keys.</p>
            <button className="os-btn os-btn-primary" onClick={connect} disabled={status === 'connecting'}>
              {status === 'connecting' ? 'Waiting for wallet…' : hasProvider ? 'Connect wallet' : 'Connect wallet (none found)'}
            </button>
          </>
        )}
        {error && <p className="os-error">{error}</p>}
      </div>

      <form className="os-card os-stack" onSubmit={lookup}>
        <span className="os-label">Read-only address</span>
        <div className="os-row">
          <input
            className="os-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="0x… public address"
            spellCheck={false}
            aria-label="Public address"
          />
          <button className="os-btn" type="submit">View</button>
        </div>
        {manualBalance?.error && <p className="os-error">{manualBalance.error}</p>}
        {manualBalance?.eth && (
          <p className="os-mono">
            {manualBalance.eth} ETH · <span className="os-muted">{shortHex(manualBalance.address)}</span>
          </p>
        )}
      </form>

      <p className="os-note">Signing and sending stay inside your wallet app in this build.</p>
    </div>
  )
}

// ---------- Inspector ----------

export function InspectorApp({ payload }) {
  const [query, setQuery] = useState(payload?.query || '')
  const item = classifyInput(query)

  useEffect(() => {
    if (payload?.query !== undefined) setQuery(payload.query)
  }, [payload])

  return (
    <div className="os-pad os-stack">
      <input
        className="os-input os-input-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Wallet, token symbol, or transaction hash"
        spellCheck={false}
        aria-label="Inspect query"
        autoFocus
      />
      {item.kind === 'empty' && <p className="os-muted">Paste an address, a tx hash, or a token symbol.</p>}
      {item.kind === 'address' && (
        <div className="os-card os-stack">
          <Tag tone="ok">address</Tag>
          <div className="os-mono os-wrap">{item.value}</div>
          <a className="os-btn" href={explorerUrl(item)} target="_blank" rel="noopener noreferrer">Open in explorer ↗</a>
        </div>
      )}
      {item.kind === 'tx' && (
        <div className="os-card os-stack">
          <Tag tone="ok">transaction</Tag>
          <div className="os-mono os-wrap">{item.value}</div>
          <a className="os-btn" href={explorerUrl(item)} target="_blank" rel="noopener noreferrer">Open in explorer ↗</a>
        </div>
      )}
      {item.kind === 'symbol' && (
        <div className="os-card os-stack">
          <Tag tone="warn">symbol</Tag>
          <div className="os-big">{item.value}</div>
          <p className="os-muted">Symbols are not unique. Always check the contract address before trading.</p>
        </div>
      )}
      {item.kind === 'unknown' && <p className="os-error">Not a 0x address, a 64-character tx hash, or a symbol.</p>}
      <p className="os-note">Inspector only reads public data. It never signs anything.</p>
    </div>
  )
}

// ---------- Network ----------

export function NetworkApp() {
  const [block, setBlock] = useState(null)
  const [gwei, setGwei] = useState(null)
  const [latency, setLatency] = useState(null)
  const [down, setDown] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const t0 = performance.now()
      try {
        const [b, g] = await Promise.all([rpc('eth_blockNumber'), rpc('eth_gasPrice')])
        if (cancelled) return
        setBlock(Number.parseInt(b, 16))
        setGwei((Number(BigInt(g)) / 1e9).toFixed(3))
        setLatency(Math.round(performance.now() - t0))
        setDown(false)
      } catch {
        if (!cancelled) setDown(true)
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="os-pad os-stack">
      <div className="os-card os-stack">
        <div className="os-row os-between">
          <span className="os-label">Chain</span>
          <Tag tone={down ? 'err' : 'ok'}>{down ? 'unreachable' : 'online'}</Tag>
        </div>
        <div className="os-kv"><span>Network</span><span>{RH_CHAIN.name} · {RH_CHAIN.id}</span></div>
        <div className="os-kv"><span>Block</span><span className="os-mono">{block ? block.toLocaleString('en-US') : '—'}</span></div>
        <div className="os-kv"><span>Gas</span><span className="os-mono">{gwei ? `${gwei} gwei` : '—'}</span></div>
        <div className="os-kv"><span>RPC latency</span><span className="os-mono">{latency ? `${latency} ms` : '—'}</span></div>
      </div>
      <div className="os-card os-stack">
        <div className="os-row os-between">
          <span className="os-label">Tor</span>
          <Tag tone="warn">simulated</Tag>
        </div>
        <p className="os-muted os-small">
          A browser tab cannot route traffic through Tor. The native VOID.OS will do that. In this demo the status is for show only.
        </p>
      </div>
    </div>
  )
}
