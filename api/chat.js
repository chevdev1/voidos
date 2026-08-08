import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  detectTriggers,
  pickPrompts,
  buildSystemPrompt,
  mockReply,
  callGemini,
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
    const message = String(body.message || '').trim()
    if (!message) return res.status(400).json({ error: 'empty message' })

    const guestKey =
      String(body.guestKey || '').trim() ||
      `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const owns = Array.isArray(body.ownerships) ? body.ownerships : []
    const history = Array.isArray(body.history) ? body.history.slice(-16) : []
    const memories = body.memories && typeof body.memories === 'object' ? body.memories : {}

    const triggers = detectTriggers(message, owns)
    const selected = pickPrompts(prompts, triggers)
    const system = buildSystemPrompt(selected, owns, memories)

    let reply
    let mode = 'mock'
    try {
      const live = await callGemini({
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        system,
        history,
        userMessage: message,
      })
      if (live) {
        reply = live
        mode = 'gemini'
      } else {
        reply = mockReply(message, owns, triggers)
      }
    } catch {
      reply = mockReply(message, owns, triggers)
      mode = 'mock'
    }

    return res.status(200).json({ reply, mode, guestKey, triggers, ownerships: owns })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'chat failed' })
  }
}
