import { listMapOwnerships } from '../shared/voidDb.js'
import { cors } from './_http.js'

/** Public reserved lots + top wallet holders (no auth). */
export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' })
  }

  try {
    const data = await listMapOwnerships()
    return res.status(200).json({ ok: true, ...data })
  } catch (err) {
    console.error('[map-ownerships]', err)
    return res.status(500).json({ error: 'map ownerships failed' })
  }
}
