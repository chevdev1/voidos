// VOID.OS demo: pure helpers (no DOM, no React). Safe to import from node tests.

export const RH_CHAIN = {
  id: 4663,
  name: 'Robinhood Chain',
  rpc: 'https://rpc.mainnet.chain.robinhood.com',
  explorer: 'https://robinhoodchain.blockscout.com',
  geckoNetwork: 'robinhood',
}

/** Classify what the user pasted into Inspector / Spotlight. */
export function classifyInput(raw) {
  const value = String(raw || '').trim()
  if (!value) return { kind: 'empty', value: '' }
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return { kind: 'tx', value }
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return { kind: 'address', value }
  if (/^[A-Za-z0-9]{2,12}$/.test(value)) return { kind: 'symbol', value: value.toUpperCase() }
  return { kind: 'unknown', value }
}

export function explorerUrl(item) {
  if (item.kind === 'tx') return `${RH_CHAIN.explorer}/tx/${item.value}`
  return `${RH_CHAIN.explorer}/address/${item.value}`
}

export function shortHex(value) {
  if (!value || value.length < 12) return value || ''
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

/** Format a USD-like number for tables: $1.23K, $4.56M. */
export function formatCompactUsd(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  if (abs >= 1) return `$${v.toFixed(2)}`
  return `$${v.toPrecision(3)}`
}

export function formatPercent(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

/** Map GeckoTerminal trending_pools JSON to table rows. Unknown shapes give []. */
// Missing numbers stay NaN (shown as a dash), never 0.
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v))

export function mapTrendingPools(json) {
  const list = Array.isArray(json?.data) ? json.data : []
  return list
    .map((item) => {
      const a = item?.attributes || {}
      const name = String(a.name || '')
      const symbol = name.split(' / ')[0].trim() || 'UNKNOWN'
      const pct = a.price_change_percentage || {}
      const tx = a.transactions?.h24 || {}
      const createdMs = Date.parse(a.pool_created_at || '')
      return {
        id: item?.id || name,
        symbol,
        pair: name,
        price: num(a.base_token_price_usd),
        change1h: num(pct.h1),
        change6h: num(pct.h6),
        change24h: num(pct.h24),
        volume24h: Number(a.volume_usd?.h24),
        liquidity: num(a.reserve_in_usd),
        fdv: num(a.fdv_usd),
        marketCap: num(a.market_cap_usd),
        buys24h: Number(tx.buys),
        sells24h: Number(tx.sells),
        buyers24h: Number(tx.buyers),
        sellers24h: Number(tx.sellers),
        createdAt: Number.isFinite(createdMs) ? createdMs : null,
        poolAddress: String(item?.id || '').split('_').pop(),
        tokenAddress: String(item?.relationships?.base_token?.data?.id || '').split('_').pop() || null,
      }
    })
    .filter((row) => Number.isFinite(row.volume24h))
}

// Pure helpers for the market screen.
export function ageOf(createdAt, now = Date.now()) {
  if (!createdAt) return null
  return Math.max(0, now - createdAt)
}

export function formatAge(ms) {
  if (ms === null || ms === undefined) return '—'
  const h = ms / 3600000
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`
  if (h < 48) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 60) return `${Math.round(d)}d`
  return `${Math.round(d / 30)}mo`
}

export const AGE_FILTERS = [
  { id: 'all', label: 'any age', test: () => true },
  { id: '24h', label: '< 24h', test: (ms) => ms !== null && ms < 86400000 },
  { id: '7d', label: '< 7d', test: (ms) => ms !== null && ms < 7 * 86400000 },
  { id: '30d', label: '> 30d', test: (ms) => ms !== null && ms > 30 * 86400000 },
]

export const SORTS = {
  trending: { label: 'Trending', cmp: (x, y) => (y.volume24h ?? 0) - (x.volume24h ?? 0) },
  new: { label: 'New', cmp: (x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0) },
  gainers: { label: 'Gainers', cmp: (x, y) => (y.change24h ?? -Infinity) - (x.change24h ?? -Infinity) },
  losers: { label: 'Losers', cmp: (x, y) => (x.change24h ?? Infinity) - (y.change24h ?? Infinity) },
  volume: { label: 'Volume', cmp: (x, y) => (y.volume24h ?? 0) - (x.volume24h ?? 0) },
}

/** Placeholder rows shown when the live feed is unavailable. Clearly labeled as demo in the UI. */
export const DEMO_MARKET = [
  { id: 'demo-1', symbol: 'NOVA', pair: 'NOVA / WETH', price: 0.0421, change1h: 3.1, change6h: 9.4, change24h: 18.4, volume24h: 1280000, liquidity: 640000, fdv: 4200000, marketCap: 3100000, buys24h: 812, sells24h: 455, buyers24h: 410, sellers24h: 260, createdAt: Date.now() - 9 * 3600000 },
  { id: 'demo-2', symbol: 'LYRA', pair: 'LYRA / WETH', price: 1.92, change1h: -0.8, change6h: -2.2, change24h: -4.1, volume24h: 860000, liquidity: 410000, fdv: 19200000, marketCap: 15000000, buys24h: 530, sells24h: 611, buyers24h: 290, sellers24h: 330, createdAt: Date.now() - 240 * 86400000 },
  { id: 'demo-3', symbol: 'ORION', pair: 'ORION / USDC', price: 0.0077, change1h: 1.2, change6h: 4.0, change24h: 9.7, volume24h: 430000, liquidity: 210000, fdv: 770000, marketCap: 500000, buys24h: 301, sells24h: 220, buyers24h: 180, sellers24h: 140, createdAt: Date.now() - 3 * 86400000 },
  { id: 'demo-4', symbol: 'VOID', pair: 'VOID / WETH', price: 0.0013, change1h: 0.3, change6h: 1.1, change24h: 2.2, volume24h: 190000, liquidity: 95000, fdv: 1300000, marketCap: 900000, buys24h: 140, sells24h: 133, buyers24h: 98, sellers24h: 91, createdAt: Date.now() - 45 * 86400000 },
  { id: 'demo-5', symbol: 'VEGA', pair: 'VEGA / USDC', price: 0.34, change1h: -5.6, change6h: -9.0, change24h: -11.8, volume24h: 88000, liquidity: 52000, fdv: 3400000, marketCap: 2100000, buys24h: 77, sells24h: 118, buyers24h: 60, sellers24h: 95, createdAt: Date.now() - 1 * 86400000 },
]


export const poolUrl = (poolAddress) => `https://www.geckoterminal.com/robinhood/pools/${poolAddress}`
export const tokenUrl = (tokenAddress) => `${RH_CHAIN.explorer}/token/${tokenAddress}`

// Pure: turns a raw RPC block into the row we show. Exported for tests.
export function toRow(block) {
  const num = Number.parseInt(block.number, 16)
  const used = Number(BigInt(block.gasUsed))
  const limit = Number(BigInt(block.gasLimit))
  return {
    num,
    txs: Array.isArray(block.transactions) ? block.transactions.length : 0,
    gasUsed: used,
    gasPct: limit ? Math.round((used / limit) * 100) : 0,
    time: Number.parseInt(block.timestamp, 16) * 1000,
  }
}

// Returns { page } for a built-in address, { url } for a web address, or { error }.
export function resolveAddress(raw, builtIn = ['void://start', 'void://docs', 'void://robinhood']) {
  const target = String(raw || '').trim()
  if (!target) return { error: 'Type an address.' }
  if (target.startsWith('void://')) {
    return builtIn.includes(target) ? { page: target } : { page: 'void://start' }
  }
  const url = /^https?:\/\//i.test(target) ? target : `https://${target}`
  try {
    const u = new URL(url)
    if (!u.hostname.includes('.')) return { error: 'That does not look like a website address.' }
    return { url: u.href }
  } catch {
    return { error: 'That does not look like a website address.' }
  }
}
