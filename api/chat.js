import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  detectTriggers,
  pickPrompts,
  buildSystemPrompt,
  callGemini,
  safetyReply,
  resilientFallback,
  isCannedAssistantReply,
  DEFAULT_GEMINI_MODEL,
} from '../shared/mindLogic.js'
import {
  getOrCreateUser,
  syncOwnedLotNames,
  listOwnerships,
  loadMemories,
  saveMemory,
  getOrCreateConversation,
  loadHistory,
  addMessage,
  ensurePromptsSeeded,
  loadActivePrompts,
  publicUser,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'
import { cors, readBody, isSecureReq } from './_http.js'

export const config = { maxDuration: 30 }

const promptsPack = JSON.parse(
  readFileSync(join(process.cwd(), 'shared', 'mind-prompts.json'), 'utf8'),
)

function normalizeClientOwn(o) {
  const id = String(o?.constel_id || o?.id || '').trim()
  if (!id) return null
  return {
    constel_id: id,
    constel_name: String(o.constel_name || o.name || id),
    claimed_at: o.claimed_at || null,
    trained: Boolean(o.trained || o.trained_at),
    trained_at: o.trained_at || null,
  }
}

function mergeOwnsForChat(dbList, clientList) {
  const map = new Map()
  for (const raw of [...(dbList || []), ...(clientList || []).map(normalizeClientOwn)]) {
    if (!raw) continue
    const id = String(raw.constel_id || raw.id || '').trim()
    if (!id) continue
    const prev = map.get(id)
    map.set(id, {
      ...prev,
      ...raw,
      constel_id: id,
      constel_name: raw.constel_name || raw.name || prev?.constel_name || id,
      claimed_at: raw.claimed_at || prev?.claimed_at || null,
      trained: Boolean(prev?.trained || raw.trained || raw.trained_at),
      trained_at: raw.trained_at || prev?.trained_at || null,
    })
  }
  return [...map.values()]
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    await ensurePromptsSeeded(promptsPack)
    const body = readBody(req)
    const message = String(body.message || '').trim().slice(0, 2000)
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey = resolveGuestKey(req, body.guestKey)
    const user = await getOrCreateUser(guestKey)

    // Push client ledger into DB so Mind sees claimed lots (esp. without durable Turso)
    const clientOwns = Array.isArray(body.ownerships) ? body.ownerships : []
    if (clientOwns.length) {
      await syncOwnedLotNames(user.id, clientOwns)
    }

    const dbOwns = await listOwnerships(user.id)
    // Prefer merged ledger so named lots like "VEIN DRIFT 100" resolve even if DB lagged
    const owns = mergeOwnsForChat(dbOwns, clientOwns)
    const memories = await loadMemories(user.id)
    const conv = await getOrCreateConversation(user.id)
    const history = (await loadHistory(conv.id, 24)).filter(
      (m) => m?.role !== 'assistant' || !isCannedAssistantReply(m.content),
    )

    const blocked = safetyReply(message)
    if (blocked) {
      await addMessage(conv.id, 'user', message)
      await addMessage(conv.id, 'assistant', blocked)
      res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
      return res.status(200).json({
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

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    let reply = null
    let live = false

    if (apiKey) {
      try {
        reply = await callGemini({
          apiKey,
          model,
          system,
          history,
          userMessage: message,
          owns,
        })
        if (reply) live = true
      } catch (err) {
        console.warn('[chat] gemini failed', err?.message || err)
      }
    }

    // Never leave the visitor with signal-thinned — always a mind reply
    if (!reply) {
      reply = resilientFallback(message, owns, triggers)
      live = false
    }

    await addMessage(conv.id, 'assistant', reply)
    const nextHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]

    res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
    return res.status(200).json({
      reply,
      live,
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: owns,
      history: nextHistory.slice(-40),
    })
  } catch (err) {
    console.error('[chat]', err)
    const message = String(readBody(req)?.message || '').trim().slice(0, 2000)
    const reply = message
      ? resilientFallback(message, [], detectTriggers(message))
      : 'i am still here. ask again.'
    return res.status(200).json({
      reply,
      live: false,
      error: undefined,
    })
  }
}
