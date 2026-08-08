import {
  getOrCreateUser,
  upsertOwnerships,
  listOwnerships,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)
    const lots = Array.isArray(body.lots) ? body.lots : []
    if (!lots.length) {
      return res.status(200).json({
        ok: true,
        guestKey: user.guest_key,
        user: publicUser(user),
        ownerships: await listOwnerships(user.id),
      })
    }

    const ownerships = await upsertOwnerships(user.id, lots)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships,
    })
  } catch (err) {
    console.error('[claim-sync]', err)
    return res.status(500).json({ error: 'claim sync failed' })
  }
}
