import { cors } from './_http.js'

/** Google auth removed — site is guest-only. */
export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  return res.status(410).json({
    error: 'google auth removed — guest session only',
    guestOnly: true,
  })
}
