import {
  getOrCreateUser,
  upsertOwnerships,
  listOwnerships,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'
import { isEvmAddress, isClaimLive } from '../shared/rhChain.js'

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

    if (isClaimLive()) {
      return res.status(403).json({
        error: 'paid claim only — confirm the burn tx, then /api/claim-verify',
        code: 'CLAIM_PAID_ONLY',
        claimLive: true,
      })
    }

    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(401).json({
        error: 'link wallet before claiming lots',
        code: 'WALLET_REQUIRED',
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
    if (err?.code === 'LOT_RESERVED' || /already reserved/i.test(err?.message || '')) {
      return res.status(409).json({
        error: err.message || 'lot already reserved',
        code: 'LOT_RESERVED',
        constelId: err.constelId || null,
      })
    }
    return res.status(500).json({ error: 'claim sync failed' })
  }
}
