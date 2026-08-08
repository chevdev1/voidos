import {
  resolveGuestKey,
  getOrCreateUser,
  publicUser,
} from '../shared/voidDb.js'
import { cors, readBody } from './_http.js'

const RPC =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com'

const EXO_MINT = process.env.EXO_MINT || process.env.VITE_EXO_MINT || ''

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'rpc error')
  return data.result
}

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
        balances: { sol: null, exo: null },
      })
    }

    const lamports = await rpc('getBalance', [pubkey, { commitment: 'confirmed' }])
    const sol = (lamports?.value ?? lamports ?? 0) / 1e9

    let exo = null
    if (EXO_MINT) {
      try {
        const tok = await rpc('getTokenAccountsByOwner', [
          pubkey,
          { mint: EXO_MINT },
          { encoding: 'jsonParsed' },
        ])
        const accounts = tok?.value || []
        let amount = 0
        for (const a of accounts) {
          const info = a?.account?.data?.parsed?.info?.tokenAmount
          if (info?.uiAmount != null) amount += Number(info.uiAmount)
        }
        exo = amount
      } catch {
        exo = null
      }
    }

    return res.status(200).json({
      ok: true,
      user: publicUser(user),
      wallet: pubkey,
      balances: {
        sol: Number(sol.toFixed(6)),
        exo: exo == null ? null : Number(exo),
        exoMint: EXO_MINT || null,
        rpc: RPC.includes('mainnet') ? 'mainnet' : 'custom',
      },
    })
  } catch (err) {
    console.error('[wallet-balance]', err)
    return res.status(500).json({ error: err.message || 'balance failed' })
  }
}
