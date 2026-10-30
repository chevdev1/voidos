import { useMemo, useState } from 'react'
import { TokenLogo } from './apps.jsx'
import { useTrending } from './useTrending.js'
import {
  AGE_FILTERS,
  SORTS,
  ageOf,
  formatAge,
  formatCompactUsd,
  formatPercent,
  poolUrl,
  tokenUrl,
  shortHex,
} from './lib.js'

const fmtPrice = (p) => (Number.isFinite(p) ? `$${p < 1 ? p.toPrecision(3) : p.toFixed(2)}` : '—')
const cls = (n) => (n >= 0 ? 'os-up' : 'os-down')

function Stat({ label, value, tone }) {
  return (
    <div className="os-mstat">
      <span className="os-label">{label}</span>
      <b className={`os-mono ${tone || ''}`}>{value}</b>
    </div>
  )
}

function BuySell({ buys, sells }) {
  const total = (buys || 0) + (sells || 0)
  const pct = total ? Math.round((buys / total) * 100) : 0
  return (
    <div className="os-mstat os-mstat-wide">
      <span className="os-label">Buys / sells 24h</span>
      <div className="os-ratio" role="img" aria-label={`${pct}% buys`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="os-mono os-small">
        <span className="os-up">{buys ?? '—'}</span> / <span className="os-down">{sells ?? '—'}</span>
        {total ? <span className="os-muted"> · {pct}% buys</span> : null}
      </span>
    </div>
  )
}

export function MarketApp() {
  const { rows, source } = useTrending()
  const [sort, setSort] = useState('trending')
  const [age, setAge] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [now] = useState(() => Date.now())

  const shown = useMemo(() => {
    const ageTest = AGE_FILTERS.find((f) => f.id === age).test
    const term = q.trim().toLowerCase()
    return rows
      .filter((r) => ageTest(ageOf(r.createdAt, now)))
      .filter((r) => !term || r.symbol.toLowerCase().includes(term))
      .sort(SORTS[sort].cmp)
  }, [rows, sort, age, q, now])

  return (
    <div className="os-pad os-stack">
      <div className="os-row os-between">
        <div>
          <div className="os-title-sm">Robinhood Chain · markets</div>
          <div className="os-muted os-small">
            {source === 'live' ? 'Live from GeckoTerminal' : 'Demo data (live feed unavailable)'} · {shown.length} tokens
          </div>
        </div>
        <input
          className="os-input os-mkt-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="symbol…"
          aria-label="Search tokens"
          spellCheck={false}
        />
      </div>

      <div className="os-chips" role="group" aria-label="Sort">
        {Object.keys(SORTS).map((k) => (
          <button key={k} className={`os-chip ${sort === k ? 'is-on' : ''}`} onClick={() => setSort(k)}>
            {SORTS[k].label}
          </button>
        ))}
      </div>
      <div className="os-chips" role="group" aria-label="Age">
        {AGE_FILTERS.map((f) => (
          <button key={f.id} className={`os-chip ${age === f.id ? 'is-on' : ''}`} onClick={() => setAge(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="os-table os-mkt" role="table" aria-label="Tokens">
        <div className="os-tr os-th os-mkt-cols" role="row">
          <span>Token</span><span>Price</span><span>24h</span><span>Age</span><span>Vol 24h</span>
        </div>

        {shown.map((t) => {
          const isOpen = open === t.id
          const ratio = t.buys24h + t.sells24h
          return (
            <div key={t.id} role="row" className={`os-mkt-row ${isOpen ? 'is-open' : ''}`}>
              <button className="os-tr os-mkt-cols os-mkt-main" role="cell" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.id)}>
                <span className="os-token">
                  <TokenLogo address={t.tokenAddress} symbol={t.symbol} />
                  <span className="os-token-name">
                    <span className="os-sym">{t.symbol}</span>
                    <span className="os-muted os-small">{t.tokenAddress ? shortHex(t.tokenAddress) : t.pair}</span>
                  </span>
                </span>
                <span className="os-mono">{fmtPrice(t.price)}</span>
                <span className={`os-mono ${cls(t.change24h)}`}>{formatPercent(t.change24h)}</span>
                <span className="os-mono">{formatAge(ageOf(t.createdAt, now))}</span>
                <span className="os-mono">{formatCompactUsd(t.volume24h)}</span>
              </button>

              {isOpen && (
                <div className="os-mkt-details">
                  <Stat label="1h" value={formatPercent(t.change1h)} tone={cls(t.change1h)} />
                  <Stat label="6h" value={formatPercent(t.change6h)} tone={cls(t.change6h)} />
                  <Stat label="Liquidity" value={formatCompactUsd(t.liquidity)} />
                  <Stat label="FDV" value={formatCompactUsd(t.fdv)} />
                  <Stat label="Market cap" value={formatCompactUsd(t.marketCap)} />
                  <Stat label="Buyers / sellers" value={`${t.buyers24h ?? '—'} / ${t.sellers24h ?? '—'}`} />
                  <BuySell buys={t.buys24h} sells={t.sells24h} />
                  <Stat label="Launched" value={t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '—'} />
                  <div className="os-mkt-links">
                    {t.poolAddress && (
                      <a className="os-btn" href={poolUrl(t.poolAddress)} target="_blank" rel="noopener noreferrer">Chart ↗</a>
                    )}
                    {t.tokenAddress && (
                      <a className="os-btn" href={tokenUrl(t.tokenAddress)} target="_blank" rel="noopener noreferrer">Explorer ↗</a>
                    )}
                    {ratio === 0 && <span className="os-muted os-small">no trades in 24h</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!shown.length && (
          <div className="os-tr os-muted" role="row">No token matches these filters.</div>
        )}
      </div>

      <p className="os-note">
        Age is the pool's creation time, not the token's. Ranking is by data, not advice. Always check the contract before trading.
      </p>
    </div>
  )
}
