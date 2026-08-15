import {
  getOrCreateUser,
  upsertOwnerships,
  listOwnerships,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'
import { verifyClaimReceipt } from '../shared/rhVerify.js'
import { isClaimLive, isEvmAddress, claimPricePerLotWei } from '../shared/rhChain.js'

/**
 * After on-chain claim tx: verify receipt on Robinhood Chain, then upsert ownerships.
 * When claim contract is not configured, returns 503 (use /api/claim-sync for test).
 */
export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    if (!isClaimLive()) {
      return res.status(503).json({
        error: 'claim is not available',
        claimLive: false,
      })
    }

    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)
    const txHash = String(body.txHash || body.hash || '').trim()
    const lots = Array.isArray(body.lots) ? body.lots : []

    if (!lots.length) {
      return res.status(400).json({ error: 'lots required' })
    }
    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(400).json({ error: 'link Robinhood wallet first' })
    }

    const receipt = await verifyClaimReceipt({
      txHash,
      expectedFrom: user.wallet_pubkey,
      minAmount: claimPricePerLotWei() * BigInt(lots.length),
    })

    const ownerships = await upsertOwnerships(user.id, lots)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships,
      receipt,
      claimLive: true,
    })
  } catch (err) {
    console.error('[claim-verify]', err)
    if (err?.code === 'LOT_RESERVED' || /already reserved/i.test(err?.message || '')) {
      return res.status(409).json({
        error: err.message || 'lot already reserved',
        code: 'LOT_RESERVED',
        constelId: err.constelId || null,
      })
    }
    return res.status(400).json({ error: err.message || 'claim verify failed' })
  }
}
