import {
  resolveGuestKey,
  getOrCreateUser,
  publicUser,
} from '../shared/voidDb.js'
import { cors, readBody } from './_http.js'
import { readRhBalances } from '../shared/rhVerify.js'
import { isEvmAddress } from '../shared/rhChain.js'

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET only' })
  }

  try {
    const body = req.method === 'GET' ? {} : readBody(req)
    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)
    const pubkey = String(body.pubkey || user.wallet_pubkey || '').trim()

    if (!pubkey) {
      return res.status(200).json({
        ok: true,
        user: publicUser(user),
        wallet: null,
        balances: { eth: null, exo: null },
      })
    }

    if (!isEvmAddress(pubkey)) {
      return res.status(400).json({ error: 'invalid EVM address' })
    }

    const balances = await readRhBalances(pubkey)

    return res.status(200).json({
      ok: true,
      user: publicUser(user),
      wallet: pubkey,
      balances,
    })
  } catch (err) {
    console.error('[wallet-balance]', err)
    return res.status(500).json({ error: err.message || 'balance failed' })
  }
}
