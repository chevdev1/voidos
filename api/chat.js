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

const prompts = JSON.parse(
  readFileSync(join(process.cwd(), 'shared', 'mind-prompts.json'), 'utf8'),
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const message = String(body.message || '').trim().slice(0, 2000)
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey =
      String(body.guestKey || '').trim() ||
      `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    // Ownership is display/context only — never trust chat to invent grants.
    // Cap and sanitize ids/names from the client.
    const owns = (Array.isArray(body.ownerships) ? body.ownerships : [])
      .slice(0, 64)
      .filter((o) => o && (o.constel_id || o.id))
      .map((o) => ({
        constel_id: String(o.constel_id || o.id).slice(0, 64),
        constel_name: String(o.constel_name || o.name || o.constel_id || o.id).slice(0, 80),
        claimed_at: o.claimed_at ? String(o.claimed_at).slice(0, 40) : null,
      }))
    const history = Array.isArray(body.history) ? body.history.slice(-16) : []
    const memories = body.memories && typeof body.memories === 'object' ? body.memories : {}

    const blocked = safetyReply(message)
    if (blocked) {
      return res.status(200).json({ reply: blocked, guestKey, ownerships: owns })
    }

    const triggers = detectTriggers(message)
    const selected = pickPrompts(prompts, triggers)
    const system = buildSystemPrompt(selected, owns, memories)

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

    return res.status(200).json({ reply, guestKey, ownerships: owns })
  } catch (err) {
    return res.status(500).json({ error: 'chat failed' })
  }
}
