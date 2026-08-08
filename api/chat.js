import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const promptsPack = JSON.parse(
  readFileSync(join(process.cwd(), 'shared', 'mind-prompts.json'), 'utf8'),
)

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
    const owns = await listOwnerships(user.id)
    const memories = await loadMemories(user.id)
    const conv = await getOrCreateConversation(user.id)
    const history = await loadHistory(conv.id, 24)

    const blocked = safetyReply(message)
    if (blocked) {
      await addMessage(conv.id, 'user', message)
      await addMessage(conv.id, 'assistant', blocked)
      res.setHeader('Set-Cookie', sidCookie(user.guest_key, { secure: isSecureReq(req) }))
      return res.status(200).json({
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

    let reply
    try {
      const live = await callGemini({
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
        system,
        history,
        userMessage: message,
        owns,
      })
      reply = live || mockReply(message, owns, triggers)
    } catch {
      reply = mockReply(message, owns, triggers)
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
      guestKey: user.guest_key,
      user: publicUser(user),
      ownerships: owns,
      history: nextHistory.slice(-40),
    })
  } catch (err) {
    console.error('[chat]', err)
    return res.status(500).json({ error: 'chat failed' })
  }
}
