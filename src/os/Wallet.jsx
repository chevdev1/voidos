import { useCallback, useEffect, useMemo, useState } from 'react'
import { RH_CHAIN, shortHex } from './lib.js'
import {
  COINS,
  PRICE_REFRESH_MS,
  PRICE_STALE_MS,
  fetchPrices,
  readPrices,
  writePrices,
  usdValue,
  readDemo,
  writeDemo,
  makeDemoAccount,
  assetsOf,
} from './walletData.js'

// A MetaMask / Phantom style wallet. Everything is clickable. Demo accounts can be created and switched freely.
// Connecting asks the real wallet (its own window confirms). Nothing here signs or sends a transaction.

const ETH_MAINNET = 1
const ROBINHOOD_PARAMS = {
  chainId: '0x1237',
  chainName: 'Robinhood Chain',
  rpcUrls: [RH_CHAIN.rpc],
  blockExplorerUrls: [RH_CHAIN.explorer],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
}

// Token contracts we know for certain. Everything else is shown only if the wallet reports it.
const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'
const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

const DEMO_ACTIVITY = [
  { kind: 'Received', sym: 'USDT', amount: '+150', when: '2 days ago' },
  { kind: 'Swapped', sym: 'ETH', amount: '0.1 → 230 USDC', when: '5 days ago' },
  { kind: 'Sent', sym: 'SOL', amount: '-0.5', when: '1 week ago' },
]
const FIRST_DEMO = { id: 'demo-1', name: 'Demo account 1', address: '0x6a37f3c4b1e25d8a9f0c2e7b4d1a6c3f8e927005', balances: { ETH: 0.42, USDT: 150, SOL: 3.1, BTC: 0.0021, USDC: 40 } }

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)
const fmtUsd = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtAmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 })

function deepLinks() {
  return {
    metamask: `https://metamask.app.link/dapp/${window.location.href.replace(/^https?:\/\//, '')}`,
    phantom: `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`,
  }
}

async function evmAssets(provider, account, chainId) {
  const out = []
  const wei = await provider.request({ method: 'eth_getBalance', params: [account, 'latest'] })
  out.push({ sym: 'ETH', amount: Number(BigInt(wei)) / 1e18 })
  if (chainId === ETH_MAINNET) {
    const pad = account.toLowerCase().replace('0x', '').padStart(64, '0')
    const raw = await provider.request({ method: 'eth_call', params: [{ to: USDT_ETH, data: `0x70a08231${pad}` }, 'latest'] }).catch(() => '0x0')
    out.push({ sym: 'USDT', amount: Number(BigInt(raw)) / 1e6 })
  }
  return out
}

async function solanaAssets(account) {
  const rpc = async (method, params) => {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    return (await res.json()).result
  }
  const out = []
  const bal = await rpc('getBalance', [account]).catch(() => null)
  if (bal) out.push({ sym: 'SOL', amount: bal.value / 1e9 })
  const tokens = await rpc('getTokenAccountsByOwner', [account, { programId: SPL_TOKEN_PROGRAM }, { encoding: 'jsonParsed' }]).catch(() => null)
  for (const t of tokens?.value || []) {
    const info = t.account.data.parsed.info
    if (info.mint === USDC_SOL) out.push({ sym: 'USDC', amount: info.tokenAmount.uiAmount || 0 })
  }
  return out
}

async function bitcoinAssets(address) {
  const json = await (await fetch(`https://mempool.space/api/address/${address}`)).json()
  const s = json.chain_stats
  return [{ sym: 'BTC', amount: (s.funded_txo_sum - s.spent_txo_sum) / 1e8 }]
}

// Logo: the real coin image from CoinGecko. If it has not loaded (or the network is down), a colored disc with the symbol.
function Coin({ sym, image, size = 36 }) {
  const [broken, setBroken] = useState(false)
  if (image && !broken) {
    return <img className="os-coin os-coin-img" src={image} alt="" width={size} height={size} onError={() => setBroken(true)} loading="lazy" decoding="async" />
  }
  return (
    <span className="os-coin" style={{ width: size, height: size, background: COINS[sym]?.color || '#333', fontSize: size * 0.36 }} aria-hidden="true">
      {sym.slice(0, 1)}
    </span>
  )
}

// ----- sheets: each action opens a full sheet inside the window -----

function Sheet({ title, onClose, children }) {
  return (
    <div className="os-sheet" role="dialog" aria-label={title}>
      <header className="os-sheet-head">
        <button className="os-btn" onClick={onClose} aria-label="Back">‹ Back</button>
        <b>{title}</b>
        <span />
      </header>
      <div className="os-sheet-body">{children}</div>
    </div>
  )
}

function SendSheet({ rows, onClose }) {
  const [sym, setSym] = useState(rows[0]?.sym || 'ETH')
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [review, setReview] = useState(false)
  const valid = Number(amount) > 0 && /^0x[a-fA-F0-9]{40}$/.test(to.trim())
  const asset = rows.find((a) => a.sym === sym)
  return (
    <Sheet title="Send" onClose={onClose}>
      {!review ? (
        <>
          <label className="os-field">
            <span className="os-label">Asset</span>
            <select value={sym} onChange={(e) => setSym(e.target.value)} className="os-input">
              {rows.map((a) => <option key={a.sym} value={a.sym}>{a.sym} · {fmtAmt(a.amount)} available</option>)}
            </select>
          </label>
          <label className="os-field">
            <span className="os-label">Amount</span>
            <div className="os-row">
              <input className="os-input os-mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" aria-label="Amount" />
              <button className="os-btn" onClick={() => setAmount(String(asset?.amount ?? 0))}>Max</button>
            </div>
          </label>
          <label className="os-field">
            <span className="os-label">To</span>
            <input className="os-input os-mono" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… recipient" aria-label="Recipient address" spellCheck={false} />
          </label>
          {to && !/^0x[a-fA-F0-9]{40}$/.test(to.trim()) && <p className="os-error">That is not an EVM address.</p>}
          <button className="os-btn os-btn-primary os-wide" disabled={!valid} onClick={() => setReview(true)}>Review</button>
        </>
      ) : (
        <>
          <div className="os-review">
            <div className="os-row os-between"><span className="os-muted">Sending</span><b className="os-mono">{amount} {sym}</b></div>
            <div className="os-row os-between"><span className="os-muted">To</span><span className="os-mono os-small">{shortHex(to.trim())}</span></div>
            <div className="os-row os-between"><span className="os-muted">Network fee</span><span className="os-muted">estimated in your wallet</span></div>
          </div>
          <p className="os-note">This preview does not sign or send anything. Your wallet confirms and sends the transaction, so your keys never reach VOID.OS.</p>
          <div className="os-row">
            <button className="os-btn" onClick={() => setReview(false)}>Edit</button>
            <button className="os-btn os-btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function ReceiveSheet({ address, isDemo, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked: the address is still on screen */
    }
  }
  return (
    <Sheet title="Receive" onClose={onClose}>
      <div className="os-receive">
        <span className="os-label">Your address</span>
        <code className="os-address">{address}</code>
        <button className="os-btn os-btn-primary os-wide" onClick={copy}>{copied ? 'Copied' : 'Copy address'}</button>
        {isDemo ? (
          <p className="os-error">Demo address. It is not a real account, so do not send funds to it.</p>
        ) : (
          <p className="os-note">Only send assets on the network this address belongs to.</p>
        )}
      </div>
    </Sheet>
  )
}

function SwapSheet({ prices, onClose }) {
  const syms = Object.keys(COINS)
  const [from, setFrom] = useState('ETH')
  const [to, setTo] = useState('USDC')
  const [amount, setAmount] = useState('0.1')
  const [quote, setQuote] = useState(false)
  const pf = prices[from]?.usd
  const pt = prices[to]?.usd
  const out = pf != null && pt != null && Number(amount) > 0 ? (Number(amount) * pf) / pt : null
  const swap = () => {
    setFrom(to)
    setTo(from)
    setQuote(false)
  }
  return (
    <Sheet title="Swap" onClose={onClose}>
      <div className="os-swap">
        <div className="os-swap-leg">
          <span className="os-label">You pay</span>
          <div className="os-row os-between">
            <input className="os-input os-mono os-swap-amt" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(false) }} aria-label="Amount to swap" />
            <select className="os-input" value={from} onChange={(e) => { setFrom(e.target.value); setQuote(false) }} aria-label="From asset">
              {syms.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button className="os-swap-flip" onClick={swap} aria-label="Switch assets">⇅</button>
        <div className="os-swap-leg">
          <span className="os-label">You receive</span>
          <div className="os-row os-between">
            <span className="os-swap-amt os-mono">{out == null ? '—' : fmtAmt(out.toFixed(6))}</span>
            <select className="os-input" value={to} onChange={(e) => { setTo(e.target.value); setQuote(false) }} aria-label="To asset">
              {syms.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <p className="os-muted os-small">Rate from live market prices. The final price is set when your wallet quotes the swap.</p>
        <button className="os-btn os-btn-primary os-wide" onClick={() => setQuote(true)} disabled={out == null}>Get quote</button>
        {quote && out != null && (
          <div className="os-review">
            <p className="os-small">1 {from} ≈ {fmtAmt((pf / pt).toFixed(6))} {to}</p>
            <p className="os-note">Swaps are confirmed in your wallet app. This preview does not trade.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function BuySheet({ onClose }) {
  return (
    <Sheet title="Buy" onClose={onClose}>
      <p className="os-muted os-small">Buying with a card or bank is handled by your wallet, which picks the provider and shows the fees.</p>
      <div className="os-stack">
        <a className="os-btn os-wide" href="https://metamask.io/buy-crypto/" target="_blank" rel="noopener noreferrer">Buy in MetaMask ↗</a>
        <a className="os-btn os-wide" href="https://phantom.com/buy" target="_blank" rel="noopener noreferrer">Buy in Phantom ↗</a>
      </div>
    </Sheet>
  )
}

function ConnectSheet({ providers, busy, error, onClose }) {
  return (
    <Sheet title="Connect a wallet" onClose={onClose}>
      <p className="os-muted os-small">Your wallet opens to confirm. VOID.OS never sees your keys or seed phrase.</p>
      {providers.map((r) => (
        <div key={r.key} className="os-wallet-row">
          <div className="os-wallet-meta">
            <b>{r.name}</b>
            <span className="os-muted os-small">{r.note}</span>
          </div>
          {r.on ? (
            <span className="os-tag os-tag-ok">connected</span>
          ) : r.ready ? (
            <button className="os-btn os-btn-primary" onClick={r.connect} disabled={busy !== ''}>{busy === r.key ? 'Waiting…' : 'Connect'}</button>
          ) : isMobile ? (
            <a className="os-btn" href={r.mobile} target="_blank" rel="noopener noreferrer">Open in app ↗</a>
          ) : (
            <a className="os-btn" href={r.install} target="_blank" rel="noopener noreferrer">Install ↗</a>
          )}
        </div>
      ))}
      {error && <p className="os-error" role="alert">{error}</p>}
    </Sheet>
  )
}

// ----- the wallet -----

export function Wallet() {
  const [found, setFound] = useState({})
  const [evm, setEvm] = useState(null) // { name, provider, account, chainId }
  const [sol, setSol] = useState(null) // { account }
  const [btc, setBtc] = useState(null) // { address }
  const [connectedAssets, setConnectedAssets] = useState([])
  const [prices, setPrices] = useState(() => readPrices()?.prices ?? {})
  const [priceAt, setPriceAt] = useState(() => readPrices()?.at ?? null)
  const [demo, setDemo] = useState(() => {
    const saved = readDemo()
    if (saved) return saved
    return { accounts: [FIRST_DEMO], active: FIRST_DEMO.id }
  })
  const [viewDemo, setViewDemo] = useState(true)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [tab, setTab] = useState('tokens')
  const [sheet, setSheet] = useState(null) // send | receive | swap | buy | connect
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [menu, setMenu] = useState(false)
  const [sortUsd, setSortUsd] = useState(true)

  useEffect(() => {
    writeDemo(demo)
  }, [demo])

  // EIP-6963: each wallet answers with its info and provider.
  useEffect(() => {
    const onAnnounce = (e) => {
      const { info, provider } = e.detail || {}
      if (!info?.rdns || !provider) return
      setFound((f) => (f[info.rdns] ? f : { ...f, [info.rdns]: { info, provider } }))
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  // Live prices and logos, refreshed every minute. A failed refresh keeps the last good values, labelled with their age.
  const refreshPrices = useCallback(async () => {
    try {
      const res = await fetchPrices()
      writePrices(res)
      setPrices(res.prices)
      setPriceAt(res.at)
    } catch {
      /* keep what we have; the view shows its age */
    }
  }, [])

  useEffect(() => {
    const cached = readPrices()
    if (!cached || Date.now() - cached.at > 60 * 1000) refreshPrices()
    const id = setInterval(refreshPrices, PRICE_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshPrices])

  const metamask = found['io.metamask']?.provider
  const phantomEvm = found['app.phantom']?.provider
  const phantomSolana = typeof window !== 'undefined' ? window.phantom?.solana : undefined
  const phantomBtc = typeof window !== 'undefined' ? window.phantom?.bitcoin : undefined
  const connected = Boolean(evm || sol || btc)
  const isDemo = viewDemo || !connected
  const activeDemo = demo.accounts.find((a) => a.id === demo.active) ?? demo.accounts[0]

  const refreshConnected = useCallback(async (next) => {
    const e = next.evm ?? evm
    const s = next.sol ?? sol
    const b = next.btc ?? btc
    const all = []
    if (e) {
      const chainId = Number.parseInt(await e.provider.request({ method: 'eth_chainId' }), 16)
      all.push(...(await evmAssets(e.provider, e.account, chainId).catch(() => [])))
    }
    if (s) all.push(...(await solanaAssets(s.account).catch(() => [])))
    if (b) all.push(...(await bitcoinAssets(b.address).catch(() => [])))
    setConnectedAssets(all)
  }, [evm, sol, btc])

  async function connectEvm(name, provider, key) {
    setError('')
    setBusy(key)
    try {
      const [account] = await provider.request({ method: 'eth_requestAccounts' })
      const chainId = await provider.request({ method: 'eth_chainId' })
      const next = { name, provider, account, chainId }
      setEvm(next)
      setViewDemo(false)
      await refreshConnected({ evm: next })
      setSheet(null)
    } catch (e) {
      setError(e?.code === 4001 ? 'Connection was declined in the wallet.' : e?.message || 'Could not connect.')
    } finally {
      setBusy('')
    }
  }

  async function connectPhantom() {
    setError('')
    setBusy('phantom-sol')
    try {
      const { publicKey } = await phantomSolana.connect()
      const next = { account: publicKey.toString() }
      setSol(next)
      let btcNext = null
      if (phantomBtc?.requestAccounts) {
        const [acc] = await phantomBtc.requestAccounts().catch(() => [])
        if (acc?.address) btcNext = { address: acc.address }
        setBtc(btcNext)
      }
      setViewDemo(false)
      await refreshConnected({ sol: next, btc: btcNext })
      setSheet(null)
    } catch (e) {
      setError(e?.message || 'Could not connect to Phantom.')
    } finally {
      setBusy('')
    }
  }

  async function switchToRobinhood() {
    if (!evm) return
    setError('')
    try {
      await evm.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ROBINHOOD_PARAMS.chainId }] })
    } catch (e) {
      if (e?.code === 4902) await evm.provider.request({ method: 'wallet_addEthereumChain', params: [ROBINHOOD_PARAMS] }).catch(() => {})
      else if (e?.code !== 4001) setError('The wallet did not switch networks.')
    }
    const chainId = await evm.provider.request({ method: 'eth_chainId' }).catch(() => evm.chainId)
    const next = { ...evm, chainId }
    setEvm(next)
    await refreshConnected({ evm: next })
  }

  function disconnectAll() {
    setEvm(null)
    setSol(null)
    setBtc(null)
    setConnectedAssets([])
    setViewDemo(true)
    setMenu(false)
  }

  // ----- demo accounts -----

  function addDemoAccount() {
    const next = makeDemoAccount(demo.accounts.length + 1)
    setDemo((d) => ({ accounts: [...d.accounts, next], active: next.id }))
    setViewDemo(true)
    setAccountsOpen(false)
  }

  function selectDemo(id) {
    setDemo((d) => ({ ...d, active: id }))
    setViewDemo(true)
    setAccountsOpen(false)
  }

  function removeDemo(id) {
    if (demo.accounts.length <= 1) return
    const accounts = demo.accounts.filter((a) => a.id !== id)
    setDemo({ accounts, active: demo.active === id ? accounts[0].id : demo.active })
  }

  // ----- derived view -----

  const address = isDemo ? activeDemo.address : evm?.account || sol?.account || btc?.address
  const onRobinhood = evm && Number.parseInt(evm.chainId, 16) === RH_CHAIN.id
  const networkName = isDemo ? 'Demo network' : onRobinhood ? 'Robinhood Chain' : evm && Number.parseInt(evm.chainId, 16) === ETH_MAINNET ? 'Ethereum' : evm ? `Chain ${Number.parseInt(evm.chainId, 16)}` : 'Solana'

  const shown = isDemo ? assetsOf(activeDemo.balances) : connectedAssets
  const rows = useMemo(() => {
    const priced = shown.map((a) => {
      const p = prices[a.sym] ?? {}
      return { ...a, price: p.usd ?? null, change: p.change ?? null, image: p.image ?? null, usd: usdValue(a.amount, p.usd ?? null) }
    })
    return priced.sort((x, y) => (sortUsd ? (y.usd ?? 0) - (x.usd ?? 0) : x.sym.localeCompare(y.sym)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, prices, sortUsd])

  const total = rows.reduce((s, r) => s + (r.usd ?? 0), 0)
  const priceKnown = rows.some((r) => r.usd != null)
  const dayChange = rows.reduce((s, r) => s + (r.usd ?? 0) * ((r.change ?? 0) / 100), 0)
  const dayPct = total ? (dayChange / total) * 100 : 0
  const priceAge = priceAt ? Date.now() - priceAt : null
  const priceStale = priceAge != null && priceAge > PRICE_STALE_MS

  const links = deepLinks()
  const providers = [
    { key: 'metamask', name: 'MetaMask', note: 'Ethereum and EVM networks', ready: Boolean(metamask), install: 'https://metamask.io/download/', mobile: links.metamask, connect: () => connectEvm('MetaMask', metamask, 'metamask'), on: evm?.name === 'MetaMask' },
    { key: 'phantom-evm', name: 'Phantom', note: 'EVM (Ethereum, Robinhood Chain)', ready: Boolean(phantomEvm), install: 'https://phantom.com/download', mobile: links.phantom, connect: () => connectEvm('Phantom', phantomEvm, 'phantom-evm'), on: evm?.name === 'Phantom' },
    { key: 'phantom-sol', name: 'Phantom', note: 'Solana, plus Bitcoin where available', ready: Boolean(phantomSolana), install: 'https://phantom.com/download', mobile: links.phantom, connect: connectPhantom, on: Boolean(sol) },
  ]

  if (sheet === 'send') return <SendSheet rows={rows} onClose={() => setSheet(null)} />
  if (sheet === 'receive') return <ReceiveSheet address={address} isDemo={isDemo} onClose={() => setSheet(null)} />
  if (sheet === 'swap') return <SwapSheet prices={prices} onClose={() => setSheet(null)} />
  if (sheet === 'buy') return <BuySheet onClose={() => setSheet(null)} />
  if (sheet === 'connect') return <ConnectSheet providers={providers} busy={busy} error={error} onClose={() => setSheet(null)} />

  return (
    <div className="os-mm">
      <header className="os-mm-top">
        <button className="os-mm-account" onClick={() => setAccountsOpen((v) => !v)} aria-expanded={accountsOpen} aria-label="Switch account">
          <span className="os-mm-avatar" aria-hidden="true" />
          <span className="os-mm-name">
            <b>{isDemo ? activeDemo.name : 'Account 1'} <span className="os-mm-caret">▾</span></b>
            <span className="os-mm-addr os-mono">{shortHex(address)}</span>
          </span>
        </button>
        <div className="os-row">
          <span className="os-mm-chip"><span className="os-dot os-dot-ok" aria-hidden="true" /> {networkName}</span>
          <button className="os-mm-icon" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Wallet menu">☰</button>
        </div>
      </header>

      {accountsOpen && (
        <div className="os-mm-menu os-mm-accounts" role="menu">
          <span className="os-label os-mm-menu-title">Demo accounts</span>
          {demo.accounts.map((a) => (
            <div key={a.id} className={`os-mm-acct ${isDemo && a.id === activeDemo.id ? 'is-on' : ''}`}>
              <button role="menuitem" onClick={() => selectDemo(a.id)}>
                <b>{a.name}</b>
                <span className="os-mono os-small os-muted">{shortHex(a.address)}</span>
              </button>
              {demo.accounts.length > 1 && (
                <button className="os-mm-remove" aria-label={`Remove ${a.name}`} onClick={() => removeDemo(a.id)}>×</button>
              )}
            </div>
          ))}
          <button role="menuitem" className="os-mm-add" onClick={addDemoAccount}>+ Add demo account</button>
          {connected && <button role="menuitem" onClick={() => { setViewDemo(false); setAccountsOpen(false) }}>Show connected account</button>}
        </div>
      )}

      {menu && (
        <div className="os-mm-menu" role="menu">
          <button role="menuitem" onClick={() => { setSheet('connect'); setMenu(false) }}>{connected ? 'Add or switch wallet' : 'Connect a wallet'}</button>
          {evm && !onRobinhood && <button role="menuitem" onClick={() => { switchToRobinhood(); setMenu(false) }}>Switch to Robinhood Chain</button>}
          {connected && <button role="menuitem" onClick={disconnectAll}>Disconnect in VOID.OS</button>}
        </div>
      )}

      <section className="os-mm-hero">
        <span className="os-mm-total-label">{isDemo ? 'Demo balance' : 'Total balance'}</span>
        <div className="os-mm-total">{priceKnown ? fmtUsd(total) : '—'}</div>
        {priceKnown && (
          <div className={`os-mm-delta ${dayPct >= 0 ? 'os-up' : 'os-down'}`}>
            {dayPct >= 0 ? '+' : ''}{fmtUsd(dayChange)} ({dayPct.toFixed(2)}%) · 24h
          </div>
        )}
        <div className="os-mm-prices os-small os-muted">
          {priceAt
            ? `Live prices from CoinGecko · updated ${new Date(priceAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${priceStale ? ' · stale' : ''}`
            : 'Prices unavailable right now. Amounts still show, dollar values wait for the next update.'}
        </div>
        {isDemo && <p className="os-mm-demo">Demo account. Balances are made up. Connect a wallet to see your own.</p>}
      </section>

      <section className="os-mm-actions" aria-label="Actions">
        <button onClick={() => setSheet('buy')}><span>$</span>Buy</button>
        <button onClick={() => setSheet('swap')}><span>⇅</span>Swap</button>
        <button onClick={() => setSheet('send')}><span>↗</span>Send</button>
        <button onClick={() => setSheet('receive')}><span>↙</span>Receive</button>
      </section>

      <nav className="os-mm-tabs" role="tablist">
        {[['tokens', 'Tokens'], ['defi', 'DeFi'], ['nfts', 'NFTs'], ['activity', 'Activity']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <section className="os-mm-body" role="tabpanel">
        {tab === 'tokens' && (
          <>
            <div className="os-row os-between os-small">
              <span className="os-muted">{rows.length} assets</span>
              <button className="os-chip" onClick={() => setSortUsd((v) => !v)}>Sort: {sortUsd ? 'value' : 'name'}</button>
            </div>
            {rows.map((r) => (
              <button key={r.sym} className="os-mm-token" onClick={() => setSheet('send')}>
                <Coin sym={r.sym} image={r.image} />
                <span className="os-mm-token-name">
                  <b>{COINS[r.sym].name}</b>
                  <span className="os-muted os-small">
                    {fmtAmt(r.amount)} {r.sym}
                    {r.change != null && <span className={r.change >= 0 ? ' os-up' : ' os-down'}> {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%</span>}
                  </span>
                </span>
                <span className="os-mm-token-usd os-mono">{fmtUsd(r.usd)}</span>
              </button>
            ))}
            {!rows.length && <p className="os-muted os-small">No tokens found on this network.</p>}
          </>
        )}
        {tab === 'defi' && (
          <div className="os-mm-empty">
            <b>Earn is coming soon</b>
            <span className="os-muted os-small">Staking and lending will be shown here once they are verified.</span>
          </div>
        )}
        {tab === 'nfts' && (
          <div className="os-mm-empty">
            <b>No NFTs found</b>
            <span className="os-muted os-small">Collectibles from your connected accounts appear here.</span>
          </div>
        )}
        {tab === 'activity' && (
          <>
            {isDemo && <p className="os-muted os-small">Sample activity. Your transactions appear here once connected.</p>}
            {(isDemo ? DEMO_ACTIVITY : []).map((a, i) => (
              <div key={i} className="os-mm-token">
                <Coin sym={a.sym} size={32} />
                <span className="os-mm-token-name">
                  <b>{a.kind}</b>
                  <span className="os-muted os-small">{a.when}</span>
                </span>
                <span className="os-mono os-small">{a.amount}</span>
              </div>
            ))}
            {!isDemo && <p className="os-muted os-small">No recent activity on this network yet.</p>}
          </>
        )}
      </section>

      <footer className="os-mm-foot">
        {!connected ? (
          <button className="os-btn os-btn-primary os-wide" onClick={() => setSheet('connect')}>Connect a wallet</button>
        ) : (
          <span className="os-muted os-small">Connected: {[evm && evm.name, sol && 'Phantom · Solana', btc && 'Bitcoin'].filter(Boolean).join(' · ')}</span>
        )}
        {error && <p className="os-error" role="alert">{error}</p>}
      </footer>
    </div>
  )
}
