import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getOrCreateUser,
  listOwnerships,
  syncOwnedLotNames,
  publicUser,
  resolveGuestKey,
  sidCookie,
  ensurePromptsSeeded,
  getOrCreateConversation,
  loadHistory,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq, rateLimit } from './_http.js'
import { claimConfig } from '../shared/rhChain.js'

const prompts = JSON.parse(
  readFileSync(join(process.cwd(), 'shared', 'mind-prompts.json'), 'utf8'),
)

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (await rateLimit(req, res, { name: 'session', limit: 60, windowMs: 10 * 60 * 1000 })) {
    return
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    await ensurePromptsSeeded(prompts)
    const body = readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)

    const clientOwns = Array.isArray(body.ownerships) ? body.ownerships : []
    if (clientOwns.length) {
      await syncOwnedLotNames(user.id, clientOwns)
    }

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
      claimConfig: claimConfig(),
    })
  } catch (err) {
    console.error('[session]', err)
    return res.status(500).json({ error: 'session failed' })
  }
}
