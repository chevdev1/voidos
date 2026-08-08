export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const guestKey =
    String(body.guestKey || '').trim() ||
    `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const ownerships = Array.isArray(body.ownerships) ? body.ownerships : []

  return res.status(200).json({ guestKey, ownerships, ok: true })
}
