// Encrypted notes vault. The whole vault is one AES-GCM envelope, keyed by a passphrase through PBKDF2-SHA256.
// The passphrase never leaves the page and is never stored. Lose it and the notes cannot be opened: there is
// no recovery, and the UI says so before a vault is created.
// Pure functions over WebCrypto, so the same code runs in the browser and in node tests.

export const VAULT_KEY = 'void-notes-vault'
export const ITERATIONS = 600000
export const MIN_PASSPHRASE = 8

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toBase64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

export async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// AES-GCM authenticates the data: a changed byte or a wrong key makes decryption fail.
export async function seal(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)))
  return { v: 1, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) }
}

export async function open(key, box) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.ct))
  return JSON.parse(dec.decode(plain))
}

export function passphraseProblem(pass) {
  if (!pass || pass.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters.`
  return null
}

export async function createVault(passphrase, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt, iterations)
  const data = { notes: [], created: Date.now() }
  const box = await seal(key, data)
  const stored = { envelope: { v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toBase64(salt) }, box }
  return { stored, key, data }
}

export async function unlockVault(passphrase, stored) {
  if (!stored?.envelope || !stored?.box) throw new Error('No vault on this device.')
  const key = await deriveKey(passphrase, fromBase64(stored.envelope.salt), stored.envelope.iterations)
  try {
    const data = await open(key, stored.box)
    return { key, data }
  } catch {
    throw new Error('That passphrase does not open this vault.')
  }
}

export async function saveVault(key, stored, data) {
  return { ...stored, box: await seal(key, data) }
}

export function readStored(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(VAULT_KEY) || 'null')
    return v && v.envelope && v.box ? v : null
  } catch {
    return null
  }
}

export function writeStored(stored, storage = globalThis.localStorage) {
  try {
    storage.setItem(VAULT_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function eraseStored(storage = globalThis.localStorage) {
  try {
    storage.removeItem(VAULT_KEY)
  } catch {
    /* ignore */
  }
}
