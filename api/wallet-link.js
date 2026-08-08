import nacl from 'tweetnacl'
import bs58 from 'bs58'
import {
  resolveGuestKey,
  getOrCreateUser,
  linkWallet,
  unlinkWallet,
  publicUser,
  listOwnerships,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'

function verifySolanaSignature({ pubkey, message, signature }) {
  const msg = new TextEncoder().encode(String(message || ''))
  let sigBytes
  let pubBytes
  try {
    sigBytes = bs58.decode(String(signature || ''))
    pubBytes = bs58.decode(String(pubkey || ''))
  } catch {
    // Phantom sometimes returns uint8 array as JSON — accept base64 too
    try {
      sigBytes = Buffer.from(String(signature), 'base64')
      pubBytes = bs58.decode(String(pubkey || ''))
    } catch {
      return false
    }
  }
  if (sigBytes.length !== 64 || pubBytes.length !== 32) return false
  return nacl.sign.detached.verify(msg, sigBytes, pubBytes)
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)

    if (body.action === 'unlink') {
      const next = await unlinkWallet(user.id)
      res.setHeader('Set-Cookie', sidCookie(next.guest_key, { secure: isSecureReq(req) }))
      return res.status(200).json({
        ok: true,
        guestKey: next.guest_key,
        user: publicUser(next),
        ownerships: await listOwnerships(next.id),
      })
    }

    const pubkey = String(body.pubkey || body.wallet || '').trim()
    const message = String(body.message || '')
    const signature = body.signature

    if (!message.includes('VOID.OS link wallet') || !message.includes(guestKey)) {
      return res.status(400).json({ error: 'bad link message' })
    }
    // nonce freshness: 10 minutes
    const tsMatch = message.match(/ts:(\d+)/)
    const ts = tsMatch ? Number(tsMatch[1]) : 0
    if (!ts || Math.abs(Date.now() - ts) > 10 * 60 * 1000) {
      return res.status(400).json({ error: 'link message expired' })
    }

    if (!verifySolanaSignature({ pubkey, message, signature })) {
      return res.status(401).json({ error: 'invalid wallet signature' })
    }

    const next = await linkWallet(user.id, pubkey)
    res.setHeader('Set-Cookie', sidCookie(next.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: next.guest_key,
      user: publicUser(next),
      ownerships: await listOwnerships(next.id),
    })
  } catch (err) {
    console.error('[wallet-link]', err)
    return res.status(400).json({ error: err.message || 'wallet link failed' })
  }
}
