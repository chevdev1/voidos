import { DEFAULT_POOL } from './rhChain.js'

export const GECKO_NETWORK = 'robinhood'

export const MARKET_TFS = {
  '1m': { timeframe: 'minute', aggregate: 1, limit: 90 },
  '15m': { timeframe: 'minute', aggregate: 15, limit: 70 },
  '1h': { timeframe: 'hour', aggregate: 1, limit: 48 },
  '1D': { timeframe: 'day', aggregate: 1, limit: 40 },
}

function poolAddress() {
  return String(process.env.MARKET_POOL || process.env.VITE_MARKET_POOL || DEFAULT_POOL).trim()
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function fetchTokenMarket(tfKey = '15m') {
  const tf = MARKET_TFS[tfKey] || MARKET_TFS['15m']
  const pool = poolAddress()
  const base = `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}/pools/${pool}`
  const headers = { Accept: 'application/json', 'User-Agent': 'void-os-market' }

  const [poolRes, ohlcvRes] = await Promise.all([
    fetch(base, { headers }),
    fetch(
      `${base}/ohlcv/${tf.timeframe}?aggregate=${tf.aggregate}&limit=${tf.limit}&currency=usd`,
      { headers },
    ),
  ])
  if (!poolRes.ok) throw new Error(`pool ${poolRes.status}`)
  const poolJson = await poolRes.json()
  const a = poolJson?.data?.attributes || {}

  let rows = []
  if (ohlcvRes.ok) {
    const oh = await ohlcvRes.json()
    rows = Array.isArray(oh?.data?.attributes?.ohlcv_list) ? oh.data.attributes.ohlcv_list : []
  }

  const candles = rows
    .map((row) => ({
      t: num(row?.[0]),
      o: num(row?.[1]),
      h: num(row?.[2]),
      l: num(row?.[3]),
      c: num(row?.[4]),
      v: num(row?.[5]),
    }))
    .filter((k) => k.c > 0)
    .sort((x, y) => x.t - y.t)

  const price = num(a.base_token_price_usd) || candles.at(-1)?.c || 0
  const fdv = num(a.fdv_usd)
  const mcap = num(a.market_cap_usd) || fdv
  const liq = num(a.reserve_in_usd)
  const chg24 = num(a.price_change_percentage?.h24)

  if (!candles.length && price > 0) {
    candles.push({ t: Math.floor(Date.now() / 1000), o: price, h: price, l: price, c: price, v: 0 })
  }

  return {
    price,
    mcap,
    fdv,
    liq,
    chg24,
    candles,
    symbol: 'TEST',
    pool,
    tf: tfKey,
  }
}
