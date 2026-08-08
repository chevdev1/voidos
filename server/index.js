import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detectTriggers,
  pickPrompts,
  buildSystemPrompt,
  mockReply,
  callGemini,
  safetyReply,
} from '../shared/mindLogic.js'
import {
  getOrCreateUser,
  listOwnerships,
  upsertOwnerships,
  loadMemories,
  saveMemory,
  getOrCreateConversation,
  loadHistory,
  addMessage,
  ensurePromptsSeeded,
  loadActivePrompts,
  publicUser,
  registerUser,
  loginUser,
  newGuestKey,
  linkGoogleAccount,
  linkWallet,
  unlinkWallet,
} from '../shared/voidDb.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const __dirname = dirname(fileURLToPath(import.meta.url))
const promptsPack = JSON.parse(
  readFileSync(join(__dirname, '..', 'shared', 'mind-prompts.json'), 'utf8'),
)

await ensurePromptsSeeded(promptsPack)

const PORT = Number(process.env.PORT || process.env.MIND_PORT || 8787)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(GEMINI_API_KEY), db: 'libsql' })
})

app.post('/api/session', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
    if (clientOwns.length) await upsertOwnerships(user.id, clientOwns)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 40)
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
      history,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'session failed' })
  }
})

app.post('/api/register', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await registerUser(guestKey, req.body?.displayName, req.body?.password)
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'register failed' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const user = await loginUser(req.body?.displayName, req.body?.password)
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
    })
  } catch (err) {
    res.status(401).json({ error: err.message || 'login failed' })
  }
})

app.post('/api/auth-google', async (req, res) => {
  try {
    const idToken = req.body?.idToken || req.body?.credential
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
    const tres = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken || '')}`,
    )
    if (!tres.ok) return res.status(401).json({ error: 'invalid google token' })
    const data = await tres.json()
    if (clientId && data.aud !== clientId) {
      return res.status(401).json({ error: 'google audience mismatch' })
    }
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await linkGoogleAccount(guestKey, {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    })
    const conv = await getOrCreateConversation(user.id)
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
      history: await loadHistory(conv.id, 40),
    })
  } catch (err) {
    res.status(401).json({ error: err.message || 'google auth failed' })
  }
})

app.post('/api/wallet-link', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    if (req.body?.action === 'unlink') {
      const next = await unlinkWallet(user.id)
      return res.json({
        ok: true,
        guestKey: next.guest_key,
        user: publicUser(next),
        ownerships: await listOwnerships(next.id),
      })
    }
    const pubkey = String(req.body?.pubkey || '').trim()
    const message = String(req.body?.message || '')
    const signature = req.body?.signature
    if (!message.includes('VOID.OS link wallet') || !message.includes(guestKey)) {
      return res.status(400).json({ error: 'bad link message' })
    }
    const tsMatch = message.match(/ts:(\d+)/)
    const ts = tsMatch ? Number(tsMatch[1]) : 0
    if (!ts || Math.abs(Date.now() - ts) > 10 * 60 * 1000) {
      return res.status(400).json({ error: 'link message expired' })
    }
    const msg = new TextEncoder().encode(message)
    let sigBytes
    let pubBytes
    try {
      sigBytes = bs58.decode(String(signature || ''))
      pubBytes = bs58.decode(pubkey)
    } catch {
      return res.status(401).json({ error: 'invalid wallet signature' })
    }
    if (
      sigBytes.length !== 64 ||
      pubBytes.length !== 32 ||
      !nacl.sign.detached.verify(msg, sigBytes, pubBytes)
    ) {
      return res.status(401).json({ error: 'invalid wallet signature' })
    }
    const next = await linkWallet(user.id, pubkey)
    res.json({
      ok: true,
      guestKey: next.guest_key,
      user: publicUser(next),
      ownerships: await listOwnerships(next.id),
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'wallet link failed' })
  }
})

app.post('/api/wallet-balance', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const pubkey = String(req.body?.pubkey || user.wallet_pubkey || '').trim()
    if (!pubkey) {
      return res.json({
        ok: true,
        user: publicUser(user),
        wallet: null,
        balances: { sol: null, exo: null },
      })
    }
    const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const rpcRes = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [pubkey, { commitment: 'confirmed' }],
      }),
    })
    const rpcData = await rpcRes.json()
    const lamports = rpcData?.result?.value ?? 0
    const sol = lamports / 1e9
    const EXO_MINT = process.env.EXO_MINT || ''
    let exo = null
    if (EXO_MINT) {
      const tokRes = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'getTokenAccountsByOwner',
          params: [pubkey, { mint: EXO_MINT }, { encoding: 'jsonParsed' }],
        }),
      })
      const tok = await tokRes.json()
      let amount = 0
      for (const a of tok?.result?.value || []) {
        const info = a?.account?.data?.parsed?.info?.tokenAmount
        if (info?.uiAmount != null) amount += Number(info.uiAmount)
      }
      exo = amount
    }
    res.json({
      ok: true,
      user: publicUser(user),
      wallet: pubkey,
      balances: {
        sol: Number(sol.toFixed(6)),
        exo,
        exoMint: EXO_MINT || null,
        rpc: 'mainnet',
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'balance failed' })
  }
})

app.post('/api/claim-sync', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const lots = Array.isArray(req.body?.lots) ? req.body.lots : []
    const ownerships = lots.length
      ? await upsertOwnerships(user.id, lots)
      : await listOwnerships(user.id)
    res.json({ ok: true, guestKey: user.guest_key, user: publicUser(user), ownerships })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'claim sync failed' })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim().slice(0, 2000)
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const owns = await listOwnerships(user.id)
    const memories = await loadMemories(user.id)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 40)

    const blocked = safetyReply(message)
    if (blocked) {
      await addMessage(conv.id, 'user', message)
      await addMessage(conv.id, 'assistant', blocked)
      return res.json({
        reply: blocked,
        guestKey: user.guest_key,
        user: publicUser(user),
        ownerships: owns,
        history: [...history, { role: 'user', content: message }, { role: 'assistant', content: blocked }],
      })
    }

    const name = message.match(/(?:i am|i'm|меня зовут|я)\s+([A-Za-zА-Яа-яёЁ]{2,24})/i)
    if (name) await saveMemory(user.id, 'name', name[1])
    const memAfter = name ? await loadMemories(user.id) : memories

    const dbPrompts = await loadActivePrompts()
    const promptList = dbPrompts.length ? dbPrompts : promptsPack
    const triggers = detectTriggers(message)
    const selected = pickPrompts(promptList, triggers)
    const lastAssistant = [...history].reverse().find((h) => h.role === 'assistant')?.content || ''
    const system = buildSystemPrompt(selected, owns, memAfter, { lastAssistant })

    await addMessage(conv.id, 'user', message)

    let reply = null
    try {
      reply = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        system,
        history,
        userMessage: message,
        owns,
      })
    } catch (err) {
      console.warn('[mind] gemini failed', err.message)
    }
    if (!reply) reply = mockReply(message, owns, triggers)

    await addMessage(conv.id, 'assistant', reply)
    res.json({
      reply,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: owns,
      history: [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ].slice(-40),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'chat failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[mind] http://localhost:${PORT}  gemini=${Boolean(GEMINI_API_KEY)}`)
})
