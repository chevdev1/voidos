import { cors } from './_http.js'

/** Live Mind diagnostics — never leaks the key. */
export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST' })
  }

  const gemini = Boolean(String(process.env.GEMINI_API_KEY || '').trim())
  return res.status(200).json({
    ok: true,
    gemini,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  })
}
