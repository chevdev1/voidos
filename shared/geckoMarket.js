import { DEFAULT_POOL } from './rhChain.js'

export const GECKO_NETWORK = 'robinhood'

export const MARKET_TFS = {
  '1m': { sec: 60, limit: 48 },
  '15m': { sec: 900, limit: 56 },
  '1h': { sec: 3600, limit: 48 },
  '1D': { sec: 86400, limit: 30 },
}

function poolAddress() {
  return String(process.env.MARKET_POOL || process.env.VITE_MARKET_POOL || DEFAULT_POOL).trim()
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

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

export function aggregateCandles(rows, bucketSec) {
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

function sourceStepSec(rows) {
  if (!rows || rows.length < 2) return 3600
  const dts = []
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].t - rows[i - 1].t
    if (d > 0) dts.push(d)
  }
  if (!dts.length) return 3600
  dts.sort((a, b) => a - b)
  return dts[Math.floor(dts.length / 2)] || 3600
}

/** Build OHLC for a TF from one raw series. Windows/buckets always differ. */
export function candlesForTimeframe(rows, tfKey = '15m') {
  if (!rows?.length) return []
  const step = sourceStepSec(rows)
  if (tfKey === '1D') return aggregateCandles(rows, Math.max(86400, step)).slice(-30)
  if (tfKey === '1h') return aggregateCandles(rows, Math.max(3600, step)).slice(-48)
  if (tfKey === '15m') return aggregateCandles(rows, Math.max(900, step)).slice(-56)
  return rows.slice(-24)
}

let _cache = null
let _cacheAt = 0

async function fetchOhlcv(base, headers, timeframe, aggregate, limit) {
  const r = await fetch(
    `${base}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`,
    { headers },
  )
  if (!r.ok) return []
  return parseOhlcv(await r.json())
}

export async function fetchTokenMarket(tfKey = '15m') {
  const now = Date.now()
  if (_cache && now - _cacheAt < 20000) {
    return { ..._cache, candles: candlesForTimeframe(_cache.series, tfKey), tf: tfKey }
  }

  const pool = poolAddress()
  if (!pool) throw new Error('no market pool configured')
  const base = `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}/pools/${pool}`
  const headers = { Accept: 'application/json', 'User-Agent': 'void-os-market' }

  const [poolRes, min15, hour, day] = await Promise.all([
    fetch(base, { headers }),
    fetchOhlcv(base, headers, 'minute', 15, 120).catch(() => []),
    fetchOhlcv(base, headers, 'hour', 1, 168).catch(() => []),
    fetchOhlcv(base, headers, 'day', 1, 90).catch(() => []),
  ])
  if (!poolRes.ok) throw new Error(`pool ${poolRes.status}`)
  const poolJson = await poolRes.json()
  const a = poolJson?.data?.attributes || {}

  const series = [min15, hour, day].sort((x, y) => {
    const sx = x.length > 1 ? sourceStepSec(x) : 1e12
    const sy = y.length > 1 ? sourceStepSec(y) : 1e12
    if (x.length < 2) return 1
    if (y.length < 2) return -1
    return sx - sy || y.length - x.length
  })[0] || []

  const price = num(a.base_token_price_usd) || series.at(-1)?.c || 0
  if (!series.length && price > 0) {
    series.push({ t: Math.floor(Date.now() / 1000), o: price, h: price, l: price, c: price, v: 0 })
  }

  _cache = {
    price,
    mcap: num(a.market_cap_usd) || num(a.fdv_usd),
    fdv: num(a.fdv_usd),
    liq: num(a.reserve_in_usd),
    chg24: num(a.price_change_percentage?.h24),
    series,
    symbol: 'VOID',
    pool,
  }
  _cacheAt = now

  return { ..._cache, candles: candlesForTimeframe(series, tfKey), tf: tfKey }
}
