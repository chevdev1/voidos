import {
  resolveGuestKey,
  getOrCreateUser,
  linkWallet,
  unlinkWallet,
  publicUser,
  listOwnerships,
  sidCookie,
  consumeWalletLinkMessage,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq, rateLimit } from './_http.js'
import { verifyEvmLinkSignature } from '../shared/rhVerify.js'
import { isEvmAddress } from '../shared/rhChain.js'
import { getAddress } from 'viem'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (await rateLimit(req, res, { name: 'wallet-link', limit: 10, windowMs: 10 * 60 * 1000 })) {
    return
  }

  try {
    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)

    if (body.action === 'unlink') {
      const next = await unlinkWallet(user.id)
      res.setHeader('Set-Cookie', sidCookie(next.guest_key, { secure: isSecureReq(req) }))
      return res.status(200).json({
        ok: true,
        replaceOwns: true,
        guestKey: next.guest_key,
        user: publicUser(next),
        ownerships: await listOwnerships(next.id),
      })
    }

    const pubkey = String(body.pubkey || body.wallet || '').trim()
    const message = String(body.message || '')
    const signature = body.signature

    if (!isEvmAddress(pubkey)) {
      return res.status(400).json({ error: 'invalid EVM wallet address' })
    }
    if (!message.includes('VOID.OS link wallet') || !guestKey || !message.includes(`guest:${guestKey}`)) {
      return res.status(400).json({ error: 'bad link message' })
    }
    const tsMatch = message.match(/ts:(\d+)/)
    const ts = tsMatch ? Number(tsMatch[1]) : 0
    if (!ts || Math.abs(Date.now() - ts) > 10 * 60 * 1000) {
      return res.status(400).json({ error: 'link message expired' })
    }

    const ok = await verifyEvmLinkSignature({ address: pubkey, message, signature })
    if (!ok) {
      return res.status(401).json({ error: 'invalid wallet signature' })
    }
    await consumeWalletLinkMessage(message)

    const next = await linkWallet(user.id, getAddress(pubkey))
    res.setHeader('Set-Cookie', sidCookie(next.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      replaceOwns: true,
      guestKey: next.guest_key,
      user: publicUser(next),
      ownerships: await listOwnerships(next.id),
    })
  } catch (err) {
    console.error('[wallet-link]', err)
    return res.status(400).json({ error: err.message || 'wallet link failed' })
  }
}
