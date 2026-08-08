import {
  resolveGuestKey,
  sidCookie,
  linkGoogleAccount,
  publicUser,
  listOwnerships,
  getOrCreateConversation,
  loadHistory,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'

async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  if (!idToken) throw new Error('missing id_token')
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('invalid google token')
  const data = await res.json()
  if (clientId && data.aud !== clientId) throw new Error('google audience mismatch')
  if (data.email_verified === 'false' || data.email_verified === false) {
    throw new Error('google email not verified')
  }
  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = readBody(req)
    const profile = await verifyGoogleIdToken(body.idToken || body.credential)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await linkGoogleAccount(guestKey, profile)
    const ownerships = await listOwnerships(user.id)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 40)

    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships,
      history,
    })
  } catch (err) {
    console.error('[auth-google]', err)
    return res.status(401).json({ error: err.message || 'google auth failed' })
  }
}
