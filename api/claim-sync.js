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
  const lots = Array.isArray(body.lots) ? body.lots : []
  // Serverless has no durable SQLite — client is source of truth; echo merged list
  const ownerships = lots
    .filter((l) => l?.id)
    .map((l) => ({
      constel_id: String(l.id),
      constel_name: String(l.name || l.id),
      claimed_at: new Date().toISOString(),
    }))

  return res.status(200).json({ ok: true, guestKey, ownerships })
}
