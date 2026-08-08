/**
 * Durable VOID client store — Turso/libSQL on Vercel, local file SQLite otherwise.
 */
import { createClient } from '@libsql/client'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA = readFileSync(join(__dirname, 'schema.sql'), 'utf8')

let _client = null
let _migrated = false

function localFileUrl() {
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
    console.warn('[voidDb] TURSO_DATABASE_URL missing on Vercel — ephemeral /tmp db (set Turso for real persistence)')
    return 'file:/tmp/void-os.db'
  }
  const dataDir = join(__dirname, '..', 'server', 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  const file = join(dataDir, 'void.db').replace(/\\/g, '/')
  return `file:${file}`
}

export function getDb() {
  if (_client) return _client
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || ''
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || ''
  if (url) {
    _client = createClient(authToken ? { url, authToken } : { url })
  } else {
    _client = createClient({ url: localFileUrl() })
  }
  return _client
}

export async function migrate() {
  const db = getDb()
  if (_migrated) return db

  // Strip full-line SQL comments, then split statements.
  // (Previously a leading `--` comment caused the entire first CREATE to be skipped.)
  const cleaned = SCHEMA.replace(/^\s*--.*$/gm, '')
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const sql of statements) {
    try {
      await db.execute(sql)
    } catch (err) {
      console.error('[voidDb] migrate statement failed:', sql.slice(0, 80), err?.message || err)
      throw err
    }
  }

  // Soft-migrate columns if older DB lacks them
  for (const col of [
    'display_name TEXT',
    'password_hash TEXT',
    'google_sub TEXT',
    'email TEXT',
    'avatar_url TEXT',
    'wallet_pubkey TEXT',
  ]) {
    try {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col}`)
    } catch {
      /* exists */
    }
  }

  _migrated = true
  return db
}

function row(result) {
  return result.rows?.[0] || null
}

function rows(result) {
  return result.rows || []
}

export function newGuestKey() {
  return `guest_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
}

export async function getOrCreateUser(guestKey) {
  await migrate()
  const db = getDb()
  const key = String(guestKey || '').trim() || newGuestKey()
  const existing = row(
    await db.execute({ sql: 'SELECT * FROM users WHERE guest_key = ?', args: [key] }),
  )
  if (existing) return existing
  await db.execute({
    sql: 'INSERT INTO users (guest_key) VALUES (?)',
    args: [key],
  })
  return row(await db.execute({ sql: 'SELECT * FROM users WHERE guest_key = ?', args: [key] }))
}

export async function getUserById(id) {
  await migrate()
  return row(
    await getDb().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] }),
  )
}

export async function getUserByName(displayName) {
  await migrate()
  const name = String(displayName || '').trim().toLowerCase()
  if (!name) return null
  return row(
    await getDb().execute({
      sql: 'SELECT * FROM users WHERE lower(display_name) = ?',
      args: [name],
    }),
  )
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false
  const [salt, hash] = String(stored).split(':')
  const next = scryptSync(String(password), salt, 64)
  const prev = Buffer.from(hash, 'hex')
  if (prev.length !== next.length) return false
  return timingSafeEqual(prev, next)
}

export async function registerUser(guestKey, displayName, password) {
  const name = String(displayName || '').trim()
  if (name.length < 2 || name.length > 24) throw new Error('name must be 2–24 chars')
  if (!/^[a-zA-Z0-9_\-.]+$/.test(name)) throw new Error('name: letters, numbers, _ - .')
  if (String(password || '').length < 4) throw new Error('password min 4 chars')

  const taken = await getUserByName(name)
  if (taken) throw new Error('name taken')

  const user = await getOrCreateUser(guestKey)
  if (user.display_name) throw new Error('already registered')

  const password_hash = hashPassword(password)
  await getDb().execute({
    sql: 'UPDATE users SET display_name = ?, password_hash = ? WHERE id = ?',
    args: [name, password_hash, user.id],
  })
  return getUserById(user.id)
}

export async function loginUser(displayName, password) {
  const user = await getUserByName(displayName)
  if (!user?.password_hash) throw new Error('invalid credentials')
  if (!verifyPassword(password, user.password_hash)) throw new Error('invalid credentials')
  return user
}

export async function listOwnerships(userId) {
  await migrate()
  return rows(
    await getDb().execute({
      sql: `SELECT constel_id, constel_name, claimed_at FROM ownerships
            WHERE user_id = ? ORDER BY claimed_at DESC`,
      args: [userId],
    }),
  )
}

export async function upsertOwnerships(userId, lots) {
  await migrate()
  const db = getDb()
  for (const l of lots || []) {
    const id = String(l.constel_id || l.id || '').trim()
    if (!id) continue
    const name = String(l.constel_name || l.name || id).slice(0, 80)
    await db.execute({
      sql: `INSERT INTO ownerships (user_id, constel_id, constel_name, claimed_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, constel_id) DO UPDATE SET
              constel_name = excluded.constel_name`,
      args: [userId, id.slice(0, 64), name],
    })
  }
  return listOwnerships(userId)
}

export async function loadMemories(userId) {
  await migrate()
  const out = {}
  for (const r of rows(
    await getDb().execute({
      sql: 'SELECT key, value FROM memories WHERE user_id = ?',
      args: [userId],
    }),
  )) {
    out[r.key] = r.value
  }
  return out
}

export async function saveMemory(userId, key, value) {
  await migrate()
  await getDb().execute({
    sql: `INSERT INTO memories (user_id, key, value, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, key) DO UPDATE SET
            value = excluded.value, updated_at = datetime('now')`,
    args: [userId, String(key).slice(0, 64), String(value).slice(0, 500)],
  })
}

export async function getOrCreateConversation(userId) {
  await migrate()
  const db = getDb()
  const existing = row(
    await db.execute({
      sql: 'SELECT id FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      args: [userId],
    }),
  )
  if (existing) return existing
  await db.execute({
    sql: 'INSERT INTO conversations (user_id) VALUES (?)',
    args: [userId],
  })
  return row(
    await db.execute({
      sql: 'SELECT id FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      args: [userId],
    }),
  )
}

export async function loadHistory(conversationId, limit = 24) {
  await migrate()
  const result = await getDb().execute({
    sql: `SELECT role, content FROM messages
          WHERE conversation_id = ? AND role IN ('user','assistant')
          ORDER BY id DESC LIMIT ?`,
    args: [conversationId, limit],
  })
  return rows(result).reverse()
}

export async function addMessage(conversationId, role, content) {
  await migrate()
  await getDb().execute({
    sql: 'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
    args: [conversationId, role, String(content).slice(0, 8000)],
  })
}

export async function loadActivePrompts() {
  await migrate()
  return rows(
    await getDb().execute({
      sql: `SELECT slug, kind, trigger_when, priority, body FROM prompts
            WHERE active = 1 ORDER BY priority DESC, id ASC`,
    }),
  )
}

export async function ensurePromptsSeeded(fallbackJson) {
  await migrate()
  const list = Array.isArray(fallbackJson) ? fallbackJson : []
  for (const p of list) {
    await getDb().execute({
      sql: `INSERT INTO prompts (slug, kind, trigger_when, priority, body, active)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(slug) DO UPDATE SET
              kind = excluded.kind,
              trigger_when = excluded.trigger_when,
              priority = excluded.priority,
              body = excluded.body,
              active = 1`,
      args: [p.slug, p.kind, p.trigger_when, p.priority || 0, p.body],
    })
  }
}

export function publicUser(user) {
  if (!user) return null
  return {
    guestKey: user.guest_key,
    displayName: user.display_name || null,
    registered: Boolean(user.display_name || user.google_sub),
    email: user.email || null,
    avatarUrl: user.avatar_url || null,
    google: Boolean(user.google_sub),
    wallet: user.wallet_pubkey || null,
  }
}

export async function getUserByGoogleSub(sub) {
  await migrate()
  if (!sub) return null
  return row(
    await getDb().execute({
      sql: 'SELECT * FROM users WHERE google_sub = ?',
      args: [String(sub)],
    }),
  )
}

/**
 * Link Google identity to current guest session (or resume existing Google user).
 * Merges guest_key cookie session into Google account when possible.
 */
export async function linkGoogleAccount(guestKey, { sub, email, name, picture }) {
  await migrate()
  if (!sub) throw new Error('missing google sub')

  const guestUser = await getOrCreateUser(guestKey)
  const byGoogle = await getUserByGoogleSub(sub)
  if (byGoogle) {
    // Carry guest claims into the returning Google account
    if (guestUser.id !== byGoogle.id) {
      const guestOwns = await listOwnerships(guestUser.id)
      if (guestOwns.length) await upsertOwnerships(byGoogle.id, guestOwns)
    }
    await getDb().execute({
      sql: `UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url)
            WHERE id = ?`,
      args: [email || null, picture || null, byGoogle.id],
    })
    return getUserById(byGoogle.id)
  }

  const user = guestUser
  const display =
    user.display_name ||
    String(name || '')
      .trim()
      .slice(0, 24)
      .replace(/[^a-zA-Z0-9_\-.\s]/g, '')
      .replace(/\s+/g, '_') ||
    `g_${String(sub).slice(-8)}`

  let finalName = display
  const taken = await getUserByName(finalName)
  if (taken && taken.id !== user.id) {
    finalName = `${display.slice(0, 16)}_${String(sub).slice(-4)}`
  }

  await getDb().execute({
    sql: `UPDATE users SET google_sub = ?, email = ?, avatar_url = ?,
            display_name = COALESCE(display_name, ?)
          WHERE id = ?`,
    args: [String(sub), email || null, picture || null, finalName, user.id],
  })
  return getUserById(user.id)
}

export async function linkWallet(userId, pubkey) {
  await migrate()
  const key = String(pubkey || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) throw new Error('invalid wallet')
  const clash = row(
    await getDb().execute({
      sql: 'SELECT id FROM users WHERE wallet_pubkey = ? AND id != ?',
      args: [key, userId],
    }),
  )
  if (clash) throw new Error('wallet already linked to another account')
  await getDb().execute({
    sql: 'UPDATE users SET wallet_pubkey = ? WHERE id = ?',
    args: [key, userId],
  })
  return getUserById(userId)
}

export async function unlinkWallet(userId) {
  await migrate()
  await getDb().execute({
    sql: 'UPDATE users SET wallet_pubkey = NULL WHERE id = ?',
    args: [userId],
  })
  return getUserById(userId)
}

/** Cookie helpers for Vercel / Express */
export function parseCookies(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie || ''
  const out = {}
  for (const part of String(raw).split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = decodeURIComponent(part.slice(i + 1).trim())
    if (k) out[k] = v
  }
  return out
}

export function sidCookie(guestKey, { secure = true } = {}) {
  const maxAge = 60 * 60 * 24 * 365
  const parts = [
    `void_sid=${encodeURIComponent(guestKey)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function resolveGuestKey(req, bodyGuestKey) {
  const cookies = parseCookies(req)
  return (
    String(bodyGuestKey || '').trim() ||
    String(cookies.void_sid || '').trim() ||
    newGuestKey()
  )
}

export function fingerprintSession(guestKey) {
  return createHash('sha256').update(String(guestKey)).digest('hex').slice(0, 12)
}
