import {
  getOrCreateUser,
  markLotTrained,
  listOwnerships,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'
import { isEvmAddress } from '../shared/rhChain.js'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)
    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(401).json({ error: 'link wallet first', code: 'WALLET_REQUIRED' })
    }
    const constelId = String(body.constelId || body.constel_id || body.id || '').trim()
    if (!constelId) return res.status(400).json({ error: 'missing constelId' })

    const ownerships = await markLotTrained(user.id, constelId)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships,
    })
  } catch (err) {
    console.error('[lot-train]', err)
    return res.status(400).json({ error: err.message || 'train failed' })
  }
}
