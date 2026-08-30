import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync } from 'node:fs'
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
  resolveGuestKey,
  registerUser,
  loginUser,
  linkWallet,
  unlinkWallet,
  syncOwnedLotNames,
  listMapOwnerships,
  createClaimIntent,
  finalizePaidClaim,
  finalizePaidTrain,
  markLotTrained,
  sidCookie,
  consumeWalletLinkMessage,
} from '../shared/voidDb.js'
import { getAddress } from 'viem'
import { verifyEvmLinkSignature, readRhBalances, verifyClaimReceipt, verifyBurnReceipt } from '../shared/rhVerify.js'
import { claimConfig, isEvmAddress, isClaimLive, claimPricePerLotWei } from '../shared/rhChain.js'
import { normalizeLotIds } from '../shared/lotPricing.js'
import { fetchTokenMarket, MARKET_TFS } from '../shared/geckoMarket.js'
import { isSecureReq, rateLimit } from '../api/_http.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const promptsPack = JSON.parse(
  readFileSync(join(__dirname, '..', 'shared', 'mind-prompts.json'), 'utf8'),
)

await ensurePromptsSeeded(promptsPack)

const PORT = Number(process.env.PORT || process.env.MIND_PORT || 8787)
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim()
const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

const app = express()
const allowedOrigins = new Set(
  String(process.env.APP_ORIGINS || process.env.APP_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)
if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`)
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:5173')
  allowedOrigins.add('http://127.0.0.1:5173')
}
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, false)
      return callback(null, allowedOrigins.has(origin) ? origin : false)
    },
  }),
)
app.use(express.json({ limit: '256kb' }))
const guardedPostRoutes = new Set([
  '/session',
  '/register',
  '/login',
  '/wallet-link',
  '/wallet-balance',
  '/claim-sync',
  '/lot-train',
])
app.use('/api', async (req, res, next) => {
  if (
    req.method === 'POST' &&
    guardedPostRoutes.has(req.path) &&
    (await rateLimit(req, res, {
      name: `server${req.path}`,
      limit: req.path === '/login' || req.path === '/register' ? 10 : 60,
      windowMs: req.path === '/login' || req.path === '/register' ? 15 * 60 * 1000 : 10 * 60 * 1000,
    }))
  ) {
    return
  }
  return next()
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, db: 'libsql' })
})

app.get('/api/market', async (req, res) => {
  try {
    const tf = String(req.query?.tf || '15m')
    if (!MARKET_TFS[tf]) return res.status(400).json({ error: 'bad tf' })
    const data = await fetchTokenMarket(tf)
    res.json({ ok: true, ...data })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message || 'market feed failed' })
  }
})

app.post('/api/session', async (req, res) => {
  try {
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await getOrCreateUser(guestKey)
    const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
    if (clientOwns.length) await syncOwnedLotNames(user.id, clientOwns)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 40)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    res.json({
      ok: true,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: await listOwnerships(user.id),
      history,
      claimConfig: claimConfig(),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'session failed' })
  }
})

app.post('/api/register', async (req, res) => {
  try {
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await registerUser(guestKey, req.body?.displayName, req.body?.password)
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
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
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
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
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
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
    await consumeWalletLinkMessage(message)
    const next = await linkWallet(user.id, getAddress(pubkey))
    res.json({
      ok: true,
      replaceOwns: true,
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
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await getOrCreateUser(guestKey)
    const pubkey = String(req.body?.pubkey || user.wallet_pubkey || '').trim()
    if (!pubkey) {
      res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
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
    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
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
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await getOrCreateUser(guestKey)
    const lots = Array.isArray(req.body?.lots) ? req.body.lots : []
    if (lots.length && isClaimLive()) {
      return res.status(403).json({
        error: 'paid claim only — confirm the burn tx, then /api/claim-verify',
        code: 'CLAIM_PAID_ONLY',
        claimLive: true,
      })
    }
    if (lots.length && (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey))) {
      return res.status(401).json({
        error: 'link wallet before claiming lots',
        code: 'WALLET_REQUIRED',
      })
    }
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
  if (
    await rateLimit(req, res, { name: 'claim-verify', limit: 20, windowMs: 60 * 60 * 1000 })
  ) {
    return
  }
  try {
    if (!isClaimLive()) {
      return res.status(503).json({
        error: 'claim is not available',
        claimLive: false,
      })
    }
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await getOrCreateUser(guestKey)
    const txHash = String(req.body?.txHash || req.body?.hash || '').trim()
    const lots = Array.isArray(req.body?.lots) ? req.body.lots : []
    if (!lots.length) return res.status(400).json({ error: 'lots required' })
    const lotIds = normalizeLotIds(lots)
    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(400).json({ error: 'link Robinhood wallet first' })
    }
    if (req.body?.intentOnly) {
      const intent = await createClaimIntent(user.id, lots)
      res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
      return res.json({ ok: true, ...intent, claimLive: true })
    }
    const receipt = await verifyClaimReceipt({
      txHash,
      expectedFrom: user.wallet_pubkey,
      minAmount: claimPricePerLotWei() * BigInt(lots.length),
      lotIds,
    })
    const ownerships = await finalizePaidClaim(user.id, txHash, lots, req.body?.intentId)
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

app.post('/api/lot-train', async (req, res) => {
  try {
    const guestKey = resolveGuestKey(req, req.body?.guestKey)
    const user = await getOrCreateUser(guestKey)
    if (!user.wallet_pubkey || !isEvmAddress(user.wallet_pubkey)) {
      return res.status(401).json({ error: 'link wallet first', code: 'WALLET_REQUIRED' })
    }
    const constelId = String(req.body?.constelId || req.body?.constel_id || req.body?.id || '').trim()
    if (!constelId) return res.status(400).json({ error: 'missing lot' })
    const mine = (await listOwnerships(user.id)).find((o) => String(o.constel_id) === constelId)
    if (!mine) return res.status(400).json({ error: 'lot not owned' })
    if (mine.trained) return res.status(400).json({ error: 'lot already trained' })
    let txHash = ''
    if (isClaimLive()) {
      txHash = String(req.body?.txHash || req.body?.hash || '').trim()
      if (!txHash) {
        return res.status(403).json({
          error: 'paid train only — burn $VOID, then send the tx hash',
          code: 'TRAIN_PAID_ONLY',
        })
      }
      await verifyBurnReceipt({
        txHash,
        expectedFrom: user.wallet_pubkey,
        minAmount: claimPricePerLotWei(),
      })
    }
    const ownerships = isClaimLive()
      ? await finalizePaidTrain(user.id, constelId, txHash)
      : await markLotTrained(user.id, constelId)
    res.json({ ok: true, guestKey: user.guest_key, user: publicUser(user), ownerships })
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err.message || 'train failed' })
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
  if (await rateLimit(req, res, { name: 'chat', limit: 30, windowMs: 5 * 60 * 1000 })) {
    return
  }
  try {
    const message = String(req.body?.message || '').trim().slice(0, 2000)
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey = resolveGuestKey(req, req.body?.guestKey)
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
    const message = String(req.body?.message || '').trim().slice(0, 2000)
    res.json({
      reply: message
        ? resilientFallback(message, [], detectTriggers(message))
        : 'i am still here. ask again.',
      live: false,
    })
  }
})

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'invalid JSON body' })
  }
  return next(err)
})

app.use((err, _req, res, _next) => {
  console.error('[http]', err)
  return res.status(500).json({ error: 'internal server error' })
})

const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[mind] http://localhost:${PORT}  gemini=${Boolean(GEMINI_API_KEY)}`)
})
