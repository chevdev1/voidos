import { detectTriggers, resilientFallback } from '../../shared/mindLogic.js'

const GUEST_KEY = 'void_guest_key'
const OWN_KEY = 'void_ownerships'
const HIST_KEY = 'void_chat_history'
const USER_KEY = 'void_user'

function apiBase() {
  const raw = import.meta.env.VITE_MIND_API_URL
  if (raw == null || raw === '') return ''
  return String(raw).replace(/\/$/, '')
}

function url(path) {
  return `${apiBase()}${path}`
}

async function api(path, body, { timeoutMs } = {}) {
  const ctrl = timeoutMs ? new AbortController() : null
  const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetch(url(path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl?.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || `request failed ${res.status}`)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  } finally {
    if (timer) clearTimeout(timer)
  }
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
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('void-user', { detail: user || null }))
    }
  } catch {
    /* ignore */
  }
}

function lotTrainedFlag(o) {
  const n = Number(o?.trained)
  if (Number.isFinite(n) && n !== 0) return n > 0
  if (o?.trained === true) return true
  return Boolean(o?.trained_at) || String(o?.status || '').toLowerCase() === 'fed'
}

function normalizeOwn(o) {
  const id = String(o?.constel_id || o?.id || '').trim()
  if (!id) return null
  const trained = lotTrainedFlag(o)
  return {
    constel_id: id,
    constel_name: String(o.constel_name || o.name || id),
    claimed_at: o.claimed_at || null,
    trained,
    trained_at: o.trained_at || (trained ? o.claimed_at || null : null),
  }
}

/** Merge: server list is authoritative for which lots you own; keep local trained flags. */
export function mergeOwnerships(serverList, localList) {
  const localMap = new Map()
  for (const raw of localList || []) {
    const o = normalizeOwn(raw)
    if (o) localMap.set(o.constel_id, o)
  }
  if (!Array.isArray(serverList)) {
    return [...localMap.values()]
  }
  const out = []
  for (const raw of serverList) {
    const o = normalizeOwn(raw)
    if (!o) continue
    const prev = localMap.get(o.constel_id)
    out.push({
      ...o,
      claimed_at: o.claimed_at || prev?.claimed_at || null,
      trained: Boolean(o.trained || prev?.trained),
      trained_at: o.trained_at || prev?.trained_at || null,
    })
  }
  return out
}

function applyServerState(data, opts = {}) {
  if (data.guestKey) saveGuestKey(data.guestKey)
  if (data.user) saveUser(data.user)
  let ownerships = loadOwnerships()
  if (Array.isArray(data.ownerships)) {
    const replace = opts.replaceOwns || data.replaceOwns
    ownerships = replace
      ? data.ownerships.map(normalizeOwn).filter(Boolean)
      : mergeOwnerships(data.ownerships, ownerships)
    saveOwnerships(ownerships)
  }
  if (Array.isArray(data.history) && data.history.length) saveHistory(data.history)
  return {
    guestKey: data.guestKey || loadGuestKey(),
    user: data.user || loadUser(),
    ownerships,
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

/** Notify map engine that ownerships changed (server hydrate / claim). */
export function notifyOwnershipHydrate(list) {
  const lots = list || loadOwnerships()
  try {
    window.__voidHydrateOwns?.(lots)
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('void-owns', { detail: lots }))
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

export async function mindWalletLink({ pubkey, message, signature }) {
  const data = await api('/api/wallet-link', {
    guestKey: loadGuestKey(),
    pubkey,
    message,
    signature,
  })
  const state = applyServerState(data, { replaceOwns: true })
  notifyOwnershipHydrate(state.ownerships)
  return state
}

export async function mindWalletUnlink() {
  const data = await api('/api/wallet-link', {
    guestKey: loadGuestKey(),
    action: 'unlink',
  })
  const state = applyServerState(data, { replaceOwns: true })
  notifyOwnershipHydrate(state.ownerships)
  return state
}

export async function mindWalletBalance(pubkey) {
  return api('/api/wallet-balance', {
    guestKey: loadGuestKey(),
    pubkey,
  })
}

export async function mindChat(message) {
  const guestKey = loadGuestKey()
  const ownerships = loadOwnerships()
  try {
    const data = await api(
      '/api/chat',
      {
        message,
        guestKey,
        ownerships,
      },
      { timeoutMs: 28000 },
    )
    const state = applyServerState(data)
    if (data.reply) {
      const hist = loadHistory()
      if (!Array.isArray(data.history)) {
        saveHistory([
          ...hist,
          { role: 'user', content: message },
          { role: 'assistant', content: data.reply },
        ])
      }
    }
    return { ...state, reply: data.reply, live: data.live !== false }
  } catch (err) {
    // Client-side safety net: never show signal-thinned if /api is down
    const owns = loadOwnerships()
    const reply = resilientFallback(message, owns, detectTriggers(message))
    const history = loadHistory()
    const next = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]
    saveHistory(next)
    return {
      reply,
      live: false,
      guestKey: guestKey || loadGuestKey(),
      ownerships: owns,
      user: loadUser(),
      history: next,
      error: err?.message || 'chat unreachable',
    }
  }
}

export async function mindClaimSync(lots) {
  if (!lots?.length) return loadOwnerships()

  try {
    const data = await api('/api/claim-sync', {
      guestKey: loadGuestKey(),
      lots,
    })
    const state = applyServerState(data)
    notifyOwnershipHydrate(state.ownerships)
    try {
      await mindMapOwnerships({ force: true })
    } catch {
      /* ignore */
    }
    return state.ownerships
  } catch (err) {
    if (err?.status === 409 || err?.data?.code === 'LOT_RESERVED') {
      try {
        await mindMapOwnerships({ force: true })
      } catch {
        /* ignore */
      }
      throw err
    }
    // Only keep optimistic local ledger when truly offline
    const offline =
      typeof navigator !== 'undefined' && navigator.onLine === false
    if (!offline) throw err

    const mapped = lots.map((l) => ({
      constel_id: String(l.id),
      constel_name: String(l.name || l.id),
      claimed_at: new Date().toISOString(),
    }))
    const map = new Map(loadOwnerships().map((o) => [o.constel_id, o]))
    for (const o of mapped) {
      const prev = map.get(o.constel_id)
      map.set(o.constel_id, {
        ...prev,
        ...o,
        trained: Boolean(prev?.trained),
        trained_at: prev?.trained_at || null,
      })
    }
    const merged = [...map.values()]
    saveOwnerships(merged)
    notifyOwnershipHydrate(merged)
    const soft = new Error('offline · claim saved locally — sync when back online')
    soft.code = 'CLAIM_OFFLINE'
    soft.ownerships = merged
    throw soft
  }
}

/** After on-chain claim: verify RH receipt then upsert ownerships. */
export async function mindClaimVerify({ txHash, lots }) {
  if (!lots?.length) return loadOwnerships()
  try {
    const data = await api('/api/claim-verify', {
      guestKey: loadGuestKey(),
      txHash,
      lots,
    })
    const state = applyServerState(data)
    notifyOwnershipHydrate(state.ownerships)
    try {
      await mindMapOwnerships({ force: true })
    } catch {
      /* ignore */
    }
    return state.ownerships
  } catch (err) {
    if (err?.status === 409 || err?.data?.code === 'LOT_RESERVED') {
      try {
        await mindMapOwnerships({ force: true })
      } catch {
        /* ignore */
      }
    }
    throw err
  }
}

let _mapOwnsCache = null
let _mapOwnsAt = 0

/** Public reserved lots + leaders. Cached ~45s. */
export async function mindMapOwnerships({ force = false } = {}) {
  const now = Date.now()
  if (!force && _mapOwnsCache && now - _mapOwnsAt < 45000) {
    return _mapOwnsCache
  }
  const res = await fetch(url('/api/map-ownerships'), {
    method: 'GET',
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `map ownerships failed ${res.status}`)
  }
  _mapOwnsCache = {
    lots: Array.isArray(data.lots) ? data.lots : [],
    leaders: Array.isArray(data.leaders) ? data.leaders : [],
    totals: data.totals || { claimed: 0, available: 200, total: 200 },
  }
  if (!_mapOwnsCache.leaders.length && _mapOwnsCache.lots.length) {
    const by = new Map()
    for (const l of _mapOwnsCache.lots) {
      const w = String(l.wallet || '').trim()
      const key = /^0x[a-fA-F0-9]{40}$/.test(w) ? w.toLowerCase() : 'unlinked'
      const label = /^0x[a-fA-F0-9]{40}$/.test(w) ? w : 'unlinked'
      const prev = by.get(key)
      if (!prev) by.set(key, { wallet: label, count: 1 })
      else prev.count += 1
    }
    _mapOwnsCache.leaders = [...by.values()].sort((a, b) => b.count - a.count).slice(0, 50)
  }
  _mapOwnsAt = now
  try {
    window.__voidHydrateTaken?.(_mapOwnsCache)
  } catch {
    /* ignore */
  }
  return _mapOwnsCache
}

export function peekMapOwnerships() {
  return _mapOwnsCache
}

/** Mark a claimed lot as trained after an on-chain $TEST burn (when live). */
export async function mindTrainLot(constelId, { txHash } = {}) {
  const id = String(constelId || '').trim()
  if (!id) return loadOwnerships()
  const data = await api('/api/lot-train', {
    guestKey: loadGuestKey(),
    constelId: id,
    txHash: txHash || undefined,
  })
  const state = applyServerState(data)
  notifyOwnershipHydrate(state.ownerships)
  try {
    const trained = (state.ownerships || []).find((o) => String(o.constel_id) === id && o.trained)
    if (trained) window.__voidTrainLot?.(id)
  } catch {
    /* ignore */
  }
  _mapOwnsAt = 0
  mindMapOwnerships({ force: true }).catch(() => {})
  return state.ownerships
}

export function voidToast(text, ms = 2800) {
  let el = document.getElementById('voidToast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'voidToast'
    el.className = 'void-toast'
    document.body.appendChild(el)
  }
  el.classList.remove('claim')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(el._t)
  el._t = setTimeout(() => {
    el.classList.remove('show')
    el.classList.remove('claim')
  }, ms)
}
