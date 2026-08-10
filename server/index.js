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
  callGemini,
  safetyReply,
  resilientFallback,
  DEFAULT_GEMINI_MODEL,
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
  linkWallet,
  unlinkWallet,
  syncOwnedLotNames,
  listMapOwnerships,
} from '../shared/voidDb.js'
import { getAddress } from 'viem'
import { verifyEvmLinkSignature, readRhBalances, verifyClaimReceipt } from '../shared/rhVerify.js'
import { isEvmAddress, isClaimLive } from '../shared/rhChain.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const promptsPack = JSON.parse(
  readFileSync(join(__dirname, '..', 'shared', 'mind-prompts.json'), 'utf8'),
)

await ensurePromptsSeeded(promptsPack)

const PORT = Number(process.env.PORT || process.env.MIND_PORT || 8787)
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim()
const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, db: 'libsql' })
})

app.post('/api/session', async (req, res) => {
  try {
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
    if (clientOwns.length) await syncOwnedLotNames(user.id, clientOwns)
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

app.post('/api/auth-google', (_req, res) => {
  res.status(410).json({
    error: 'google auth removed — guest session only',
    guestOnly: true,
  })
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
    if (!isEvmAddress(pubkey)) {
      return res.status(400).json({ error: 'invalid EVM wallet address' })
    }
    if (!message.includes('VOID.OS link wallet') || !message.includes(guestKey)) {
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
    const next = await linkWallet(user.id, getAddress(pubkey))
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
        balances: { eth: null, exo: null },
      })
    }
    if (!isEvmAddress(pubkey)) {
      return res.status(400).json({ error: 'invalid EVM address' })
    }
    const balances = await readRhBalances(pubkey)
    res.json({
      ok: true,
      user: publicUser(user),
      wallet: pubkey,
      balances,
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
    if (err?.code === 'LOT_RESERVED' || /already reserved/i.test(err?.message || '')) {
      return res.status(409).json({
        error: err.message || 'lot already reserved',
        code: 'LOT_RESERVED',
        constelId: err.constelId || null,
      })
    }
    res.status(500).json({ error: 'claim sync failed' })
  }
})

app.post('/api/claim-verify', async (req, res) => {
  try {
    if (!isClaimLive()) {
      return res.status(503).json({
        error: 'claim contract not live — use /api/claim-sync for test claims',
        claimLive: false,
      })
    }
    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const txHash = String(req.body?.txHash || req.body?.hash || '').trim()
    const lots = Array.isArray(req.body?.lots) ? req.body.lots : []
    if (!lots.length) return res.status(400).json({ error: 'lots required' })
    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(400).json({ error: 'link Robinhood wallet first' })
    }
    const receipt = await verifyClaimReceipt({
      txHash,
      expectedFrom: user.wallet_pubkey,
    })
    const ownerships = await upsertOwnerships(user.id, lots)
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships,
      receipt,
      claimLive: true,
    })
  } catch (err) {
    console.error(err)
    if (err?.code === 'LOT_RESERVED' || /already reserved/i.test(err?.message || '')) {
      return res.status(409).json({
        error: err.message || 'lot already reserved',
        code: 'LOT_RESERVED',
        constelId: err.constelId || null,
      })
    }
    res.status(400).json({ error: err.message || 'claim verify failed' })
  }
})

app.get('/api/map-ownerships', async (_req, res) => {
  try {
    const data = await listMapOwnerships()
    res.json({ ok: true, ...data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'map ownerships failed' })
  }
})

app.post('/api/map-ownerships', async (_req, res) => {
  try {
    const data = await listMapOwnerships()
    res.json({ ok: true, ...data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'map ownerships failed' })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim().slice(0, 2000)
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey = String(req.body?.guestKey || '').trim() || newGuestKey()
    const user = await getOrCreateUser(guestKey)
    const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
    if (clientOwns.length) {
      await syncOwnedLotNames(user.id, clientOwns)
    }
    const owns = await listOwnerships(user.id)
    const memories = await loadMemories(user.id)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 16)

    const blocked = safetyReply(message)
    if (blocked) {
      await addMessage(conv.id, 'user', message)
      await addMessage(conv.id, 'assistant', blocked)
      return res.json({
        reply: blocked,
        live: true,
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
    const system = buildSystemPrompt(selected, owns, memAfter, {
      lastAssistant,
      userMessage: message,
    })

    await addMessage(conv.id, 'user', message)

    let reply = null
    let live = false
    if (GEMINI_API_KEY) {
      try {
        reply = await callGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL,
          system,
          history,
          userMessage: message,
          owns,
        })
        if (reply) live = true
      } catch (err) {
        console.warn('[mind] gemini failed', err.message)
      }
    }
    if (!reply) {
      reply = resilientFallback(message, owns, triggers)
      live = false
    }

    await addMessage(conv.id, 'assistant', reply)
    res.json({
      reply,
      live,
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
