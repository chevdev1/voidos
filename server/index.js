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
} from '../shared/voidDb.js'

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
    const history = await loadHistory(conv.id, 24)

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
    const system = buildSystemPrompt(selected, owns, memAfter)

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
