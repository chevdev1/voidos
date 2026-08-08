import prompts from '../../shared/mind-prompts.json'
import { detectTriggers, pickPrompts, buildSystemPrompt, mockReply, safetyReply } from '../../shared/mindLogic.js'

const GUEST_KEY = 'void_guest_key'
const OWN_KEY = 'void_ownerships'
const HIST_KEY = 'void_chat_history'
const MEM_KEY = 'void_memories'

function apiBase() {
  const raw = import.meta.env.VITE_MIND_API_URL
  if (raw == null || raw === '') return ''
  return String(raw).replace(/\/$/, '')
}

function url(path) {
  return `${apiBase()}${path}`
}

export function loadGuestKey() {
  try {
    return localStorage.getItem(GUEST_KEY) || ''
  } catch {
    return ''
  }
}

export function saveGuestKey(key) {
  try {
    if (key) localStorage.setItem(GUEST_KEY, key)
  } catch {
    /* ignore */
  }
}

export function loadOwnerships() {
  try {
    return JSON.parse(localStorage.getItem(OWN_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveOwnerships(list) {
  try {
    localStorage.setItem(OWN_KEY, JSON.stringify(list || []))
  } catch {
    /* ignore */
  }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify((list || []).slice(-40)))
  } catch {
    /* ignore */
  }
}

function loadMemories() {
  try {
    return JSON.parse(localStorage.getItem(MEM_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveMemories(mem) {
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(mem || {}))
  } catch {
    /* ignore */
  }
}

function localSession(guestKey) {
  const key =
    guestKey || loadGuestKey() || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  saveGuestKey(key)
  return { guestKey: key, ownerships: loadOwnerships(), ok: true }
}

function localChat(message, guestKey) {
  const owns = loadOwnerships()
  const history = loadHistory()
  const memories = loadMemories()
  const name = message.match(/(?:i am|i'm|меня зовут|я)\s+([A-Za-zА-Яа-яёЁ]{2,24})/i)
  if (name) {
    memories.name = name[1]
    saveMemories(memories)
  }
  const blocked = safetyReply(message)
  if (blocked) {
    const next = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: blocked },
    ]
    saveHistory(next)
    return {
      reply: blocked,
      guestKey: guestKey || loadGuestKey(),
      ownerships: owns,
    }
  }
  const triggers = detectTriggers(message)
  const selected = pickPrompts(prompts, triggers)
  buildSystemPrompt(selected, owns, memories)
  const reply = mockReply(message, owns, triggers)
  const next = [
    ...history,
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ]
  saveHistory(next)
  saveGuestKey(guestKey || loadGuestKey())
  return {
    reply,
    guestKey: guestKey || loadGuestKey(),
    ownerships: owns,
  }
}

export async function mindSession() {
  const guestKey = loadGuestKey()
  const ownerships = loadOwnerships()
  try {
    const res = await fetch(url('/api/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestKey, ownerships }),
    })
    if (!res.ok) throw new Error('session failed')
    const data = await res.json()
    if (data.guestKey) saveGuestKey(data.guestKey)
    if (Array.isArray(data.ownerships) && data.ownerships.length) {
      // merge server echo with local
      const map = new Map(loadOwnerships().map((o) => [o.constel_id, o]))
      for (const o of data.ownerships) map.set(o.constel_id, o)
      saveOwnerships([...map.values()])
    }
    return { guestKey: data.guestKey || guestKey, ownerships: loadOwnerships() }
  } catch {
    return localSession(guestKey)
  }
}

export async function mindChat(message) {
  const guestKey = loadGuestKey()
  const ownerships = loadOwnerships()
  const history = loadHistory().filter((m) => m.role === 'user' || m.role === 'assistant')
  const memories = loadMemories()
  try {
    const res = await fetch(url('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, guestKey, ownerships, history, memories }),
    })
    if (!res.ok) throw new Error('chat failed')
    const data = await res.json()
    if (data.guestKey) saveGuestKey(data.guestKey)
    const next = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: data.reply },
    ]
    saveHistory(next)
    return data
  } catch {
    return localChat(message, guestKey)
  }
}

export async function mindClaimSync(lots) {
  if (!lots?.length) return loadOwnerships()
  const mapped = lots.map((l) => ({
    constel_id: String(l.id),
    constel_name: String(l.name || l.id),
    claimed_at: new Date().toISOString(),
  }))
  const map = new Map(loadOwnerships().map((o) => [o.constel_id, o]))
  for (const o of mapped) map.set(o.constel_id, o)
  const merged = [...map.values()]
  saveOwnerships(merged)

  try {
    const res = await fetch(url('/api/claim-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestKey: loadGuestKey(), lots }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.guestKey) saveGuestKey(data.guestKey)
      if (Array.isArray(data.ownerships) && data.ownerships.length) {
        const map = new Map(merged.map((o) => [o.constel_id, o]))
        for (const o of data.ownerships) map.set(o.constel_id, o)
        const next = [...map.values()]
        saveOwnerships(next)
        return next
      }
    }
  } catch {
    /* local already saved */
  }
  return merged
}

/** Tiny toast for claim / errors — no blocking alert() */
export function voidToast(text, ms = 2800) {
  let el = document.getElementById('voidToast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'voidToast'
    el.className = 'void-toast'
    document.body.appendChild(el)
  }
  el.textContent = text
  el.classList.add('show')
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('show'), ms)
}
