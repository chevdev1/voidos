import { DEFAULT_POOL } from './rhChain.js'

export const GECKO_NETWORK = 'robinhood'

export const MARKET_TFS = {
  '1m': { timeframe: 'minute', aggregate: 1, limit: 90, sec: 60 },
  '15m': { timeframe: 'minute', aggregate: 15, limit: 70, sec: 900 },
  '1h': { timeframe: 'hour', aggregate: 1, limit: 48, sec: 3600 },
  '1D': { timeframe: 'day', aggregate: 1, limit: 40, sec: 86400 },
}

const SOURCE_TRIES = [
  { timeframe: 'minute', aggregate: 1, limit: 200, sec: 60 },
  { timeframe: 'minute', aggregate: 15, limit: 200, sec: 900 },
  { timeframe: 'hour', aggregate: 1, limit: 168, sec: 3600 },
  { timeframe: 'day', aggregate: 1, limit: 90, sec: 86400 },
]

function parseOhlcv(oh) {
  const rows = Array.isArray(oh?.data?.attributes?.ohlcv_list) ? oh.data.attributes.ohlcv_list : []
  return rows
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
}

function aggregateCandles(rows, bucketSec) {
  if (!rows.length || bucketSec <= 0) return rows
  const buckets = new Map()
  for (const k of rows) {
    const t = Math.floor(k.t / bucketSec) * bucketSec
    const b = buckets.get(t)
    if (!b) {
      buckets.set(t, { t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v })
      continue
    }
    b.h = Math.max(b.h, k.h)
    b.l = Math.min(b.l, k.l)
    b.c = k.c
    b.v += k.v
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t)
}

async function fetchOhlcv(base, headers, spec) {
  try {
    const r = await fetch(
      `${base}/ohlcv/${spec.timeframe}?aggregate=${spec.aggregate}&limit=${spec.limit}&currency=usd`,
      { headers },
    )
    if (!r.ok) return []
    return parseOhlcv(await r.json())
  } catch {
    return []
  }
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

  const [poolRes, ...ohlcvLists] = await Promise.all([
    fetch(base, { headers }),
    ...SOURCE_TRIES.map((spec) => fetchOhlcv(base, headers, spec)),
  ])
  if (!poolRes.ok) throw new Error(`pool ${poolRes.status}`)
  const poolJson = await poolRes.json()
  const a = poolJson?.data?.attributes || {}

  let source = []
  let sourceSec = 86400
  SOURCE_TRIES.forEach((spec, i) => {
    const rows = ohlcvLists[i] || []
    if (rows.length < 2) return
    if (!source.length || spec.sec < sourceSec) {
      source = rows
      sourceSec = spec.sec
    }
  })
  if (!source.length) {
    SOURCE_TRIES.forEach((spec, i) => {
      const rows = ohlcvLists[i] || []
      if (rows.length > source.length) {
        source = rows
        sourceSec = spec.sec
      }
    })
  }

  const want = tf.sec
  let candles = want > sourceSec ? aggregateCandles(source, want) : source.slice(-Math.max(tf.limit, 24))

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
