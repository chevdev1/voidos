import { loginUser, publicUser, sidCookie, listOwnerships } from '../shared/voidDb.js'
import { cors, readBody, isSecureReq, rateLimit } from './_http.js'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (await rateLimit(req, res, { name: 'login', limit: 10, windowMs: 15 * 60 * 1000 })) {
    return
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = readBody(req)
    const user = await loginUser(body.displayName, body.password)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
    })
  } catch (err) {
    return res.status(401).json({ error: err.message || 'login failed' })
  }
}
