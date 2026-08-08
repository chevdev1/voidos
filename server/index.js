import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { ensureSeeded, db } from './db.js'
import {
  detectTriggers,
  pickPrompts,
  buildSystemPrompt,
  mockReply,
  callGemini,
} from '../shared/mindLogic.js'

ensureSeeded()

const PORT = Number(process.env.PORT || process.env.MIND_PORT || 8787)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function loadActivePrompts() {
  return db
    .prepare(
      `SELECT slug, kind, trigger_when, priority, body
       FROM prompts WHERE active = 1
       ORDER BY priority DESC, id ASC`,
    )
    .all()
}

function getOrCreateUser(guestKey) {
  const key =
    String(guestKey || '').trim() ||
    `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let row = db.prepare('SELECT id, guest_key FROM users WHERE guest_key = ?').get(key)
  if (!row) {
    const info = db.prepare('INSERT INTO users (guest_key) VALUES (?)').run(key)
    row = { id: Number(info.lastInsertRowid), guest_key: key }
  }
  return row
}

function listOwnerships(userId) {
  return db
    .prepare(
      `SELECT constel_id, constel_name, claimed_at
       FROM ownerships WHERE user_id = ?
       ORDER BY claimed_at DESC`,
    )
    .all(userId)
}

function upsertOwnerships(userId, lots) {
  const insert = db.prepare(
    `INSERT INTO ownerships (user_id, constel_id, constel_name, claimed_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, constel_id) DO UPDATE SET
       constel_name = excluded.constel_name`,
  )
  db.exec('BEGIN')
  try {
    for (const l of lots || []) {
      if (!l?.id && !l?.constel_id) continue
      const id = String(l.constel_id || l.id)
      const name = String(l.constel_name || l.name || id)
      insert.run(userId, id, name)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return listOwnerships(userId)
}

function loadMemories(userId) {
  const rows = db.prepare('SELECT key, value FROM memories WHERE user_id = ?').all(userId)
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

function saveMemory(userId, key, value) {
  db.prepare(
    `INSERT INTO memories (user_id, key, value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, key) DO UPDATE SET
       value = excluded.value, updated_at = datetime('now')`,
  ).run(userId, key, String(value))
}

function getOrCreateConversation(userId) {
  let row = db
    .prepare(
      `SELECT id FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(userId)
  if (!row) {
    const info = db.prepare('INSERT INTO conversations (user_id) VALUES (?)').run(userId)
    row = { id: Number(info.lastInsertRowid) }
  }
  return row
}

function loadHistory(conversationId, limit = 16) {
  return db
    .prepare(
      `SELECT role, content FROM messages
       WHERE conversation_id = ? AND role IN ('user','assistant')
       ORDER BY id DESC LIMIT ?`,
    )
    .all(conversationId, limit)
    .reverse()
}

function addMessage(conversationId, role, content) {
  db.prepare(
    `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`,
  ).run(conversationId, role, content)
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(GEMINI_API_KEY), db: 'sqlite' })
})

app.post('/api/session', (req, res) => {
  const user = getOrCreateUser(req.body?.guestKey)
  const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
  if (clientOwns.length) upsertOwnerships(user.id, clientOwns)
  res.json({
    ok: true,
    guestKey: user.guest_key,
    ownerships: listOwnerships(user.id),
  })
})

app.post('/api/claim-sync', (req, res) => {
  const user = getOrCreateUser(req.body?.guestKey)
  const lots = Array.isArray(req.body?.lots) ? req.body.lots : []
  const ownerships = upsertOwnerships(user.id, lots)
  res.json({ ok: true, guestKey: user.guest_key, ownerships })
})

app.get('/api/prompts', (_req, res) => {
  res.json({ prompts: loadActivePrompts() })
})

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim()
    if (!message) return res.status(400).json({ error: 'empty message' })

    const user = getOrCreateUser(req.body?.guestKey)
    const clientOwns = Array.isArray(req.body?.ownerships) ? req.body.ownerships : []
    if (clientOwns.length) upsertOwnerships(user.id, clientOwns)
    const owns = listOwnerships(user.id)

    const memories = { ...loadMemories(user.id), ...(req.body?.memories || {}) }
    const name = message.match(/(?:i am|i'm|меня зовут|я)\s+([A-Za-zА-Яа-яёЁ]{2,24})/i)
    if (name) {
      memories.name = name[1]
      saveMemory(user.id, 'name', name[1])
    }

    const conv = getOrCreateConversation(user.id)
    const history =
      Array.isArray(req.body?.history) && req.body.history.length
        ? req.body.history.slice(-16)
        : loadHistory(conv.id, 16)

    const triggers = detectTriggers(message)
    const selected = pickPrompts(loadActivePrompts(), triggers)
    const system = buildSystemPrompt(selected, owns, memories, message)

    addMessage(conv.id, 'user', message)

    let reply = null
    let mode = 'mock'
    try {
      reply = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        system,
        history,
        userMessage: message,
      })
      if (reply) mode = 'gemini'
    } catch (err) {
      console.warn('[mind] gemini failed', err.message)
    }
    if (!reply) {
      reply = mockReply(message, owns, triggers)
      mode = 'mock'
    }

    addMessage(conv.id, 'assistant', reply)
    res.json({ reply, mode, guestKey: user.guest_key, triggers, ownerships: owns })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'chat failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[mind] http://localhost:${PORT}  gemini=${Boolean(GEMINI_API_KEY)}`)
})
