// Wallet data: live prices and logos from CoinGecko, demo accounts stored on this device, and pure helpers.
// Nothing here is a real account unless the user connects one (see Wallet.jsx).

export const COINS = {
  BTC: { name: 'Bitcoin', id: 'bitcoin', color: '#f7931a', decimals: 6 },
  ETH: { name: 'Ethereum', id: 'ethereum', color: '#627eea', decimals: 6 },
  SOL: { name: 'Solana', id: 'solana', color: '#14f195', decimals: 4 },
  USDT: { name: 'Tether', id: 'tether', color: '#26a17b', decimals: 2 },
  USDC: { name: 'USD Coin', id: 'usd-coin', color: '#2775ca', decimals: 2 },
}

export const PRICE_KEY = 'void-wallet-prices'
export const DEMO_KEY = 'void-wallet-demo'
export const PRICE_REFRESH_MS = 60 * 1000
export const PRICE_STALE_MS = 10 * 60 * 1000

const MARKETS_URL = (ids) =>
  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h&sparkline=false`

// Keeps only what the wallet needs from the markets answer. Anything missing is null, never a guess.
export function parseMarkets(list) {
  const out = {}
  for (const [sym, meta] of Object.entries(COINS)) {
    const row = Array.isArray(list) ? list.find((c) => c.id === meta.id) : null
    out[sym] = row
      ? {
          usd: Number.isFinite(row.current_price) ? row.current_price : null,
          change: Number.isFinite(row.price_change_percentage_24h) ? row.price_change_percentage_24h : null,
          image: typeof row.image === 'string' ? row.image : null,
        }
      : { usd: null, change: null, image: null }
  }
  return out
}

export async function fetchPrices(fetchImpl = fetch) {
  const ids = Object.values(COINS).map((c) => c.id).join(',')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetchImpl(MARKETS_URL(ids), { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`prices ${res.status}`)
    return { at: Date.now(), prices: parseMarkets(await res.json()) }
  } finally {
    clearTimeout(timer)
  }
}

export function readPrices(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(PRICE_KEY) || 'null')
    return v && typeof v.at === 'number' && v.prices ? v : null
  } catch {
    return null
  }
}

export function writePrices(v, storage = globalThis.localStorage) {
  try {
    storage.setItem(PRICE_KEY, JSON.stringify(v))
  } catch {
    /* ignore: the wallet asks again next time */
  }
}

// Value of an amount in USD, or null when the price is not known.
export const usdValue = (amount, price) => (price != null && Number.isFinite(amount) ? amount * price : null)

// Demo accounts are generated, never real: random addresses, random balances in plausible ranges.
const HEX = '0123456789abcdef'
export function randomAddress(rand = Math.random) {
  let s = '0x'
  for (let i = 0; i < 40; i++) s += HEX[Math.floor(rand() * 16)]
  return s
}

export function randomBalances(rand = Math.random) {
  const pick = (max, dp) => Number((rand() * max).toFixed(dp))
  const keep = (v) => (rand() < 0.2 ? 0 : v)
  return {
    ETH: keep(pick(3, 4)),
    USDT: keep(pick(900, 2)),
    SOL: keep(pick(12, 3)),
    BTC: keep(pick(0.05, 5)),
    USDC: keep(pick(400, 2)),
  }
}

export function makeDemoAccount(index, rand = Math.random) {
  return {
    id: `d${Date.now().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
    name: `Demo account ${index}`,
    address: randomAddress(rand),
    balances: randomBalances(rand),
  }
}

export function readDemo(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(DEMO_KEY) || 'null')
    if (v && Array.isArray(v.accounts) && v.accounts.length && typeof v.active === 'string') {
      return v.accounts.every((a) => a && typeof a.id === 'string' && typeof a.address === 'string' && a.balances) ? v : null
    }
  } catch {
    /* corrupt: fall through */
  }
  return null
}

export function writeDemo(v, storage = globalThis.localStorage) {
  try {
    storage.setItem(DEMO_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

// Balances as a list of { sym, amount } for the asset table, largest first is decided by the view.
export function assetsOf(balances) {
  return Object.keys(COINS)
    .filter((sym) => Number.isFinite(balances[sym]))
    .map((sym) => ({ sym, amount: balances[sym] }))
}
