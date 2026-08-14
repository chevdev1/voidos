import { cors } from './_http.js'
import { fetchTokenMarket, MARKET_TFS } from '../shared/geckoMarket.js'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  try {
    const url = new URL(req.url, 'http://localhost')
    const tf = String(url.searchParams.get('tf') || '15m')
    if (!MARKET_TFS[tf]) return res.status(400).json({ error: 'bad tf' })
    const data = await fetchTokenMarket(tf)
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=40')
    res.setHeader('Vary', 'Accept')
    return res.status(200).json({ ok: true, ...data })
  } catch (err) {
    console.error('[market]', err)
    return res.status(502).json({ error: err.message || 'market feed failed' })
  }
}
