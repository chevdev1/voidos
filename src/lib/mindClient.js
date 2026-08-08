import prompts from '../../shared/mind-prompts.json'
import { detectTriggers, pickPrompts, buildSystemPrompt, mockReply, safetyReply } from '../../shared/mindLogic.js'

const GUEST_KEY = 'void_guest_key'
const OWN_KEY = 'void_ownerships'
const HIST_KEY = 'void_chat_history'
const MEM_KEY = 'void_memories'
const USER_KEY = 'void_user'

function apiBase() {
  const raw = import.meta.env.VITE_MIND_API_URL
  if (raw == null || raw === '') return ''
  return String(raw).replace(/\/$/, '')
}

function url(path) {
  return `${apiBase()}${path}`
}

async function api(path, body) {
  const res = await fetch(url(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `request failed ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
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

export function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
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

function applyServerState(data) {
  if (data.guestKey) saveGuestKey(data.guestKey)
  if (data.user) saveUser(data.user)
  if (Array.isArray(data.ownerships)) saveOwnerships(data.ownerships)
  if (Array.isArray(data.history) && data.history.length) saveHistory(data.history)
  return {
    guestKey: data.guestKey || loadGuestKey(),
    user: data.user || loadUser(),
    ownerships: Array.isArray(data.ownerships) ? data.ownerships : loadOwnerships(),
    history: Array.isArray(data.history) ? data.history : loadHistory(),
    reply: data.reply,
    ok: true,
  }
}

function localSession(guestKey) {
  const key =
    guestKey || loadGuestKey() || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  saveGuestKey(key)
  return { guestKey: key, ownerships: loadOwnerships(), user: loadUser(), ok: true }
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
  const reply =
    blocked ||
    (() => {
      const triggers = detectTriggers(message)
      const selected = pickPrompts(prompts, triggers)
      buildSystemPrompt(selected, owns, memories)
      return mockReply(message, owns, triggers)
    })()
  const next = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }]
  saveHistory(next)
  saveGuestKey(guestKey || loadGuestKey())
  return {
    reply,
    guestKey: guestKey || loadGuestKey(),
    ownerships: owns,
    user: loadUser(),
    history: next,
  }
}

/** Notify map engine that ownerships changed (server hydrate / claim). */
export function notifyOwnershipHydrate(list) {
  try {
    window.__voidHydrateOwns?.(list || loadOwnerships())
  } catch {
    /* ignore */
  }
}

export async function mindSession() {
  const guestKey = loadGuestKey()
  const ownerships = loadOwnerships()
  try {
    const data = await api('/api/session', { guestKey, ownerships })
    const state = applyServerState(data)
    notifyOwnershipHydrate(state.ownerships)
    return state
  } catch {
    return localSession(guestKey)
  }
}

export async function mindRegister(displayName, password) {
  const data = await api('/api/register', {
    guestKey: loadGuestKey(),
    displayName,
    password,
  })
  const state = applyServerState(data)
  notifyOwnershipHydrate(state.ownerships)
  return state
}

export async function mindLogin(displayName, password) {
  const data = await api('/api/login', { displayName, password })
  const state = applyServerState(data)
  notifyOwnershipHydrate(state.ownerships)
  return state
}

export async function mindGoogleLogin(idToken) {
  const data = await api('/api/auth-google', {
    guestKey: loadGuestKey(),
    idToken,
  })
  const state = applyServerState(data)
  notifyOwnershipHydrate(state.ownerships)
  return state
}

export async function mindWalletLink({ pubkey, message, signature }) {
  const data = await api('/api/wallet-link', {
    guestKey: loadGuestKey(),
    pubkey,
    message,
    signature,
  })
  const state = applyServerState(data)
  return state
}

export async function mindWalletUnlink() {
  const data = await api('/api/wallet-link', {
    guestKey: loadGuestKey(),
    action: 'unlink',
  })
  return applyServerState(data)
}

export async function mindWalletBalance(pubkey) {
  return api('/api/wallet-balance', {
    guestKey: loadGuestKey(),
    pubkey,
  })
}

export async function mindChat(message) {
  const guestKey = loadGuestKey()
  try {
    const data = await api('/api/chat', {
      message,
      guestKey,
    })
    const state = applyServerState(data)
    if (data.reply) {
      const hist = loadHistory()
      // server already returns history; ensure local cache
      if (!Array.isArray(data.history)) {
        saveHistory([
          ...hist,
          { role: 'user', content: message },
          { role: 'assistant', content: data.reply },
        ])
      }
    }
    return { ...state, reply: data.reply }
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
  notifyOwnershipHydrate(merged)

  try {
    const data = await api('/api/claim-sync', {
      guestKey: loadGuestKey(),
      lots,
    })
    const state = applyServerState(data)
    notifyOwnershipHydrate(state.ownerships)
    return state.ownerships
  } catch {
    return merged
  }
}

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
