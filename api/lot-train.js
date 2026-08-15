import {
  getOrCreateUser,
  markLotTrained,
  listOwnerships,
  consumePaidTx,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'
import { verifyBurnReceipt } from '../shared/rhVerify.js'
import { isEvmAddress, isClaimLive, claimPricePerLotWei } from '../shared/rhChain.js'

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
    if (!constelId) return res.status(400).json({ error: 'missing lot' })
    const mine = (await listOwnerships(user.id)).find((o) => String(o.constel_id) === constelId)
    if (!mine) return res.status(400).json({ error: 'lot not owned' })
    if (mine.trained) return res.status(400).json({ error: 'lot already trained' })

    if (isClaimLive()) {
      const txHash = String(body.txHash || body.hash || '').trim()
      if (!txHash) {
        return res.status(403).json({
          error: 'paid train only — burn $TEST, then send the tx hash',
          code: 'TRAIN_PAID_ONLY',
        })
      }
      await verifyBurnReceipt({
        txHash,
        expectedFrom: user.wallet_pubkey,
        minAmount: claimPricePerLotWei(),
      })
      await consumePaidTx(user.id, txHash, 'train')
    }

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
