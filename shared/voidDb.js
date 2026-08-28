/**
 * Durable VOID client store — Turso/libSQL on Vercel, local file SQLite otherwise.
 */
import { createClient } from '@libsql/client'
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeLotId, TOTAL_PRICED_LOTS } from './lotPricing.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA = readFileSync(join(__dirname, 'schema.sql'), 'utf8')

let _client = null
let _migrated = false

function localFileUrl() {
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required in production')
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
  if (
    (process.env.VERCEL || process.env.NODE_ENV === 'production') &&
    !url
  ) {
    throw new Error('TURSO_DATABASE_URL is required in production')
  }
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

  for (const col of [
    'trained INTEGER NOT NULL DEFAULT 0',
    'trained_at TEXT',
    'wallet TEXT',
  ]) {
    try {
      await db.execute(`ALTER TABLE ownerships ADD COLUMN ${col}`)
    } catch {
      /* exists */
    }
  }
  try {
    await db.execute(`
      UPDATE ownerships
      SET wallet = (
        SELECT u.wallet_pubkey FROM users u WHERE u.id = ownerships.user_id
      )
      WHERE (wallet IS NULL OR wallet = '')
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = ownerships.user_id
            AND u.wallet_pubkey IS NOT NULL
            AND u.wallet_pubkey != ''
        )
    `)
  } catch (err) {
    console.warn('[voidDb] ownerships wallet backfill:', err?.message || err)
  }

  // Exclusive lots: drop duplicate constel_id rows (keep earliest claim), then unique index
  try {
    await db.execute(`
      DELETE FROM ownerships
      WHERE id NOT IN (
        SELECT MIN(id) FROM ownerships GROUP BY constel_id
      )
    `)
  } catch (err) {
    console.warn('[voidDb] ownerships dedupe:', err?.message || err)
  }
  try {
    await db.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_ownerships_constel ON ownerships(constel_id)',
    )
  } catch (err) {
    console.warn('[voidDb] idx_ownerships_constel:', err?.message || err)
  }
  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet
       ON users(lower(wallet_pubkey))
       WHERE wallet_pubkey IS NOT NULL AND wallet_pubkey != ''`,
    )
  } catch (err) {
    console.warn('[voidDb] idx_users_wallet:', err?.message || err)
  }
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS paid_txs (
        tx_hash TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  } catch (err) {
    console.warn('[voidDb] paid_txs:', err?.message || err)
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

function ownerWallet(addr) {
  const w = String(addr || '').trim()
  return /^0x[a-fA-F0-9]{40}$/.test(w) ? w : ''
}

function sanitizeLotName(name, id) {
  return (
    String(name || id)
      .replace(/[<>]/g, '')
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0)
        return code < 32 || code === 127 ? ' ' : char
      })
      .join('')
      .trim()
      .slice(0, 80) || id
  )
}

function prepareLots(lots) {
  if (!Array.isArray(lots)) throw new Error('lots must be an array')
  if (lots.length > TOTAL_PRICED_LOTS) throw new Error('too many lots')
  const seen = new Set()
  const prepared = []
  for (const l of lots) {
    const rawId = typeof l === 'string' ? l : l?.constel_id || l?.id
    const id = normalizeLotId(rawId)
    if (!id) throw new Error('invalid lot id')
    if (seen.has(id)) throw new Error('duplicate lot id')
    seen.add(id)
    prepared.push({
      id,
      name: sanitizeLotName(typeof l === 'string' ? id : l?.constel_name || l?.name, id),
      trained:
        typeof l !== 'string' &&
        (Boolean(l?.trained || l?.trained_at) ||
          String(l?.status || '').toLowerCase() === 'fed'),
    })
  }
  return prepared
}

async function stampUserLotsWallet(userId, pubkey) {
  const w = ownerWallet(pubkey)
  if (!w || userId == null) return
  await getDb().execute({
    sql: `UPDATE ownerships
          SET wallet = COALESCE(NULLIF(wallet, ''), ?)
          WHERE user_id = ?`,
    args: [w, userId],
  })
}

export function newGuestKey() {
  return `guest_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
}

function sessionSecret() {
  const configured = String(process.env.SESSION_SECRET || '').trim()
  if (configured) return configured
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production')
  }
  return 'void-os-development-session-secret'
}

function signSessionGuestKey(guestKey) {
  return createHmac('sha256', sessionSecret()).update(String(guestKey)).digest('base64url')
}

function verifiedSessionGuestKey(value) {
  const raw = String(value || '')
  const separator = raw.lastIndexOf('.')
  if (separator > 0) {
    const guestKey = raw.slice(0, separator)
    const signature = raw.slice(separator + 1)
    const expected = signSessionGuestKey(guestKey)
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return guestKey
    }
  }
  // Migrate pre-signature cookies once; generated keys are unguessable and
  // the next response replaces this legacy value with a signed cookie.
  return /^guest_[a-z0-9]+_[a-f0-9]{12}$/i.test(raw) ? raw : ''
}

export async function getOrCreateUser(guestKey) {
  await migrate()
  const db = getDb()
  const key = String(guestKey || '').trim() || newGuestKey()
  const existing = row(
    await db.execute({ sql: 'SELECT * FROM users WHERE guest_key = ?', args: [key] }),
  )
  if (existing) {
    if (ownerWallet(existing.wallet_pubkey)) {
      await stampUserLotsWallet(existing.id, existing.wallet_pubkey)
    }
    return existing
  }
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

function lotTrainedFlag(r) {
  const n = Number(r?.trained)
  if (Number.isFinite(n) && n !== 0) return n > 0
  return Boolean(r?.trained_at)
}

export async function listOwnerships(userId) {
  await migrate()
  const user = await getUserById(userId)
  const w = ownerWallet(user?.wallet_pubkey)
  const result = w
    ? await getDb().execute({
        sql: `SELECT o.constel_id, o.constel_name, o.claimed_at, o.trained, o.trained_at
              FROM ownerships o
              LEFT JOIN users u ON u.id = o.user_id
              WHERE o.user_id = ?
                 OR lower(COALESCE(NULLIF(o.wallet, ''), u.wallet_pubkey, '')) = lower(?)
              ORDER BY o.claimed_at DESC`,
        args: [userId, w],
      })
    : await getDb().execute({
        sql: `SELECT constel_id, constel_name, claimed_at, trained, trained_at FROM ownerships
              WHERE user_id = ? ORDER BY claimed_at DESC`,
        args: [userId],
      })
  const seen = new Set()
  const out = []
  for (const r of rows(result)) {
    const id = normalizeLotId(r.constel_id)
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      constel_id: id,
      constel_name: String(r.constel_name || r.constel_id),
      claimed_at: r.claimed_at || null,
      trained: lotTrainedFlag(r),
      trained_at: r.trained_at || null,
    })
  }
  return out
}

/** Total claimable constellation lots on the shared map (CONSTEL_DEFS). */
export const TOTAL_MAP_LOTS = 200

/**
 * Claim lots for a user. One constel_id → one owner worldwide.
 * One wallet may own many lots. Re-claiming your own lot is idempotent.
 * If ANY lot in the batch is owned by someone else, the whole batch fails
 * (no partial claim of a stack/series).
 */
export async function upsertOwnerships(userId, lots) {
  await migrate()
  const db = getDb()
  const user = await getUserById(userId)
  const wallet = ownerWallet(user?.wallet_pubkey)
  if (!wallet) throw new Error('link wallet before claiming lots')
  const prepared = prepareLots(lots || [])
  const tx = await db.transaction('write')

  try {
    // Pre-check and insert the entire stack in one write transaction.
    for (const { id } of prepared) {
      const existing = row(
        await tx.execute({
          sql: 'SELECT id, user_id FROM ownerships WHERE constel_id = ?',
          args: [id],
        }),
      )
      if (existing && Number(existing.user_id) !== Number(userId)) {
        const err = new Error('lot already reserved')
        err.code = 'LOT_RESERVED'
        err.constelId = id
        throw err
      }
    }

    for (const { id, name } of prepared) {
      await tx.execute({
        sql: `INSERT INTO ownerships (user_id, constel_id, constel_name, claimed_at, wallet)
              VALUES (?, ?, ?, datetime('now'), ?)
              ON CONFLICT(user_id, constel_id) DO UPDATE SET
                constel_name = excluded.constel_name,
                wallet = COALESCE(ownerships.wallet, excluded.wallet)`,
        args: [userId, id, name, wallet],
      })
    }
    await tx.commit()
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* preserve the original database error */
    }
    if (/UNIQUE|unique|constraint/i.test(String(e?.message || e))) {
      const err = new Error('lot already reserved')
      err.code = 'LOT_RESERVED'
      throw err
    }
    throw e
  }
  return listOwnerships(userId)
}

export async function markLotTrained(userId, constelId) {
  await migrate()
  const id = normalizeLotId(constelId)
  if (!id) throw new Error('missing lot')
  const mine = row(
    await getDb().execute({
      sql: 'SELECT id, trained, trained_at FROM ownerships WHERE user_id = ? AND constel_id = ?',
      args: [userId, id],
    }),
  )
  if (!mine) throw new Error('lot not owned')
  if (lotTrainedFlag(mine)) throw new Error('lot already trained')
  const user = await getUserById(userId)
  const wallet = ownerWallet(user?.wallet_pubkey)
  if (wallet) await stampUserLotsWallet(userId, wallet)
  await getDb().execute({
    sql: `UPDATE ownerships
          SET trained = 1, trained_at = COALESCE(trained_at, datetime('now'))
          WHERE user_id = ? AND constel_id = ?`,
    args: [userId, id],
  })
  return listOwnerships(userId)
}

export async function consumePaidTx(userId, txHash, kind) {
  await migrate()
  const hash = String(txHash || '').trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error('invalid tx hash')
  try {
    await getDb().execute({
      sql: `INSERT INTO paid_txs (tx_hash, kind, user_id) VALUES (?, ?, ?)`,
      args: [hash, String(kind || 'pay').slice(0, 24), userId ?? null],
    })
  } catch (e) {
    if (/UNIQUE|unique|constraint/i.test(String(e?.message || e))) {
      throw new Error('this burn tx was already used')
    }
    throw e
  }
}

export async function consumeWalletLinkMessage(message) {
  await migrate()
  const value = String(message || '')
  if (!value) throw new Error('missing link message')
  const messageHash = createHash('sha256').update(value).digest('hex')
  try {
    await getDb().execute({
      sql: 'INSERT INTO used_wallet_link_messages (message_hash) VALUES (?)',
      args: [messageHash],
    })
  } catch (err) {
    if (/UNIQUE|unique|constraint/i.test(String(err?.message || err))) {
      throw new Error('link message already used')
    }
    throw err
  }
}

export async function createClaimIntent(userId, lots) {
  await migrate()
  const prepared = prepareLots(lots || [])
  if (!prepared.length) throw new Error('lots required')
  const user = await getUserById(userId)
  const wallet = ownerWallet(user?.wallet_pubkey)
  if (!wallet) throw new Error('link wallet before claiming lots')

  const intentId = randomBytes(16).toString('hex')
  const tx = await getDb().transaction('write')
  try {
    await tx.execute('DELETE FROM claim_reservations WHERE expires_at <= datetime(\'now\')')
    await tx.execute({
      sql: 'DELETE FROM claim_reservations WHERE user_id = ?',
      args: [userId],
    })
    for (const { id } of prepared) {
      const existing = row(
        await tx.execute({
          sql: 'SELECT user_id FROM claim_reservations WHERE lot_id = ?',
          args: [id],
        }),
      )
      if (existing && Number(existing.user_id) !== Number(userId)) {
        const err = new Error('lot already reserved')
        err.code = 'LOT_RESERVED'
        err.constelId = id
        throw err
      }
      await tx.execute({
        sql: `INSERT INTO claim_reservations
              (lot_id, intent_id, user_id, wallet, expires_at)
              VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))`,
        args: [id, intentId, userId, wallet],
      })
    }
    await tx.commit()
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* preserve the original database error */
    }
    if (/UNIQUE|unique|constraint/i.test(String(e?.message || e))) {
      const err = new Error('lot already reserved')
      err.code = 'LOT_RESERVED'
      throw err
    }
    throw e
  }
  return {
    intentId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
}

/**
 * Atomically consume a paid claim and write all ownership rows.
 * A confirmed on-chain payment must never be marked used before its ledger
 * update succeeds, otherwise a retry could strand the user's funds.
 */
export async function finalizePaidClaim(userId, txHash, lots, intentId) {
  await migrate()
  const hash = String(txHash || '').trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error('invalid tx hash')
  const prepared = prepareLots(lots || [])
  if (!prepared.length) throw new Error('lots required')
  if (!/^[a-f0-9]{32}$/i.test(String(intentId || ''))) {
    throw new Error('claim intent required')
  }

  const user = await getUserById(userId)
  const wallet = ownerWallet(user?.wallet_pubkey)
  if (!wallet) throw new Error('link wallet before claiming lots')

  const db = getDb()
  const tx = await db.transaction('write')
  try {
    const placeholders = prepared.map(() => '?').join(', ')
    const reservation = row(
      await tx.execute({
        sql: `SELECT COUNT(*) AS count
              FROM claim_reservations
              WHERE intent_id = ? AND user_id = ? AND wallet = ?
                AND expires_at > datetime('now')
                AND lot_id IN (${placeholders})`,
        args: [intentId, userId, wallet, ...prepared.map(({ id }) => id)],
      }),
    )
    if (Number(reservation?.count) !== prepared.length) {
      throw new Error('claim intent expired or invalid; reserve the lots again')
    }
    for (const { id } of prepared) {
      const existing = row(
        await tx.execute({
          sql: 'SELECT id, user_id FROM ownerships WHERE constel_id = ?',
          args: [id],
        }),
      )
      if (existing && Number(existing.user_id) !== Number(userId)) {
        const err = new Error('lot already reserved')
        err.code = 'LOT_RESERVED'
        err.constelId = id
        throw err
      }
    }

    await tx.execute({
      sql: 'INSERT INTO paid_txs (tx_hash, kind, user_id) VALUES (?, ?, ?)',
      args: [hash, 'claim', userId],
    })

    for (const { id, name } of prepared) {
      await tx.execute({
        sql: `INSERT INTO ownerships (user_id, constel_id, constel_name, claimed_at, wallet)
              VALUES (?, ?, ?, datetime('now'), ?)
              ON CONFLICT(user_id, constel_id) DO UPDATE SET
                constel_name = excluded.constel_name,
                wallet = COALESCE(ownerships.wallet, excluded.wallet)`,
        args: [userId, id, name, wallet],
      })
    }
    await tx.execute({
      sql: 'DELETE FROM claim_reservations WHERE intent_id = ? AND user_id = ?',
      args: [intentId, userId],
    })
    await tx.commit()
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* preserve the original database error */
    }
    if (/UNIQUE|unique|constraint/i.test(String(e?.message || e))) {
      if (/paid_txs|tx_hash|already used/i.test(String(e?.message || e))) {
        throw new Error('this burn tx was already used')
      }
      const err = new Error('lot already reserved')
      err.code = 'LOT_RESERVED'
      throw err
    }
    throw e
  }
  return listOwnerships(userId)
}

export async function finalizePaidTrain(userId, constelId, txHash) {
  await migrate()
  const id = normalizeLotId(constelId)
  const hash = String(txHash || '').trim().toLowerCase()
  if (!id) throw new Error('missing lot')
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error('invalid tx hash')

  const tx = await getDb().transaction('write')
  try {
    const mine = row(
      await tx.execute({
        sql: 'SELECT trained, trained_at FROM ownerships WHERE user_id = ? AND constel_id = ?',
        args: [userId, id],
      }),
    )
    if (!mine) throw new Error('lot not owned')
    if (lotTrainedFlag(mine)) throw new Error('lot already trained')

    await tx.execute({
      sql: 'INSERT INTO paid_txs (tx_hash, kind, user_id) VALUES (?, ?, ?)',
      args: [hash, 'train', userId],
    })
    const updated = await tx.execute({
      sql: `UPDATE ownerships
            SET trained = 1, trained_at = COALESCE(trained_at, datetime('now'))
            WHERE user_id = ? AND constel_id = ? AND trained = 0`,
      args: [userId, id],
    })
    if (Number(updated.rowsAffected || 0) !== 1) {
      throw new Error('lot already trained')
    }
    await tx.commit()
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* preserve the original database error */
    }
    if (/UNIQUE|unique|constraint/i.test(String(e?.message || e))) {
      throw new Error('this burn tx was already used')
    }
    throw e
  }
  return listOwnerships(userId)
}

/**
 * Session/chat sync: only refresh names for lots this user already owns.
 * Does not create new claims (claim goes through /api/claim-sync).
 */
export async function syncOwnedLotNames(userId, lots) {
  await migrate()
  const mine = await listOwnerships(userId)
  const mineIds = new Set(mine.map((o) => String(o.constel_id)))
  const db = getDb()
  const prepared = prepareLots(lots || [])
  for (const { id, name, trained } of prepared) {
    if (!id || !mineIds.has(id)) continue
    await db.execute({
      sql: 'UPDATE ownerships SET constel_name = ? WHERE user_id = ? AND constel_id = ?',
      args: [name, userId, id],
    })
    if (trained) {
      await db.execute({
        sql: `UPDATE ownerships
              SET trained = 1, trained_at = COALESCE(trained_at, datetime('now'))
              WHERE user_id = ? AND constel_id = ?`,
        args: [userId, id],
      })
    }
  }
  return listOwnerships(userId)
}

/** Public map ledger: all reserved lots + top wallets. */
export async function listMapOwnerships() {
  await migrate()
  const lotRows = rows(
    await getDb().execute({
      sql: `SELECT o.constel_id, o.constel_name, o.claimed_at, o.trained, o.trained_at,
                   COALESCE(NULLIF(o.wallet, ''), u.wallet_pubkey) AS wallet
            FROM ownerships o
            LEFT JOIN users u ON u.id = o.user_id
            ORDER BY o.claimed_at ASC`,
    }),
  )
  const lots = lotRows
    .map((r) => {
      const id = normalizeLotId(r.constel_id)
      if (!id) return null
      const w = ownerWallet(r.wallet)
      return {
        constel_id: id,
        constel_name: String(r.constel_name || id),
        wallet: w || null,
        claimed_at: r.claimed_at || null,
        trained: Boolean(Number(r.trained) || r.trained_at),
        trained_at: r.trained_at || null,
      }
    })
    .filter(Boolean)

  const byOwner = new Map()
  for (const l of lots) {
    const w = ownerWallet(l.wallet)
    const key = w ? w.toLowerCase() : 'unlinked'
    const label = w || 'unlinked'
    const prev = byOwner.get(key)
    if (!prev) byOwner.set(key, { wallet: label, count: 1 })
    else prev.count += 1
  }
  const leaders = [...byOwner.values()].sort((a, b) => b.count - a.count).slice(0, 50)

  const claimed = lots.length
  return {
    lots,
    leaders,
    totals: {
      claimed,
      available: Math.max(0, TOTAL_MAP_LOTS - claimed),
      total: TOTAL_MAP_LOTS,
    },
  }
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

export async function getUserByWallet(pubkey) {
  await migrate()
  const key = String(pubkey || '').trim()
  if (!key) return null
  const exact = row(
    await getDb().execute({
      sql: 'SELECT * FROM users WHERE wallet_pubkey = ?',
      args: [key],
    }),
  )
  if (exact) return exact
  return row(
    await getDb().execute({
      sql: 'SELECT * FROM users WHERE lower(wallet_pubkey) = lower(?)',
      args: [key],
    }),
  )
}

/**
 * Cabinet identity = wallet.
 * Connecting a wallet switches into that wallet's ledger (lots / train).
 * A new wallet gets a fresh cabinet; it never steals another wallet's lots.
 */
export async function linkWallet(userId, pubkey) {
  await migrate()
  const key = String(pubkey || '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(key)) throw new Error('invalid wallet')

  const owner = await getUserByWallet(key)
  if (owner) {
    await stampUserLotsWallet(owner.id, key)
    return owner
  }

  const current = await getUserById(userId)
  if (!current) throw new Error('no user')
  const curW = String(current.wallet_pubkey || '')
  if (!curW) {
    try {
      await getDb().execute({
        sql: 'UPDATE users SET wallet_pubkey = ? WHERE id = ?',
        args: [key, userId],
      })
    } catch (err) {
      if (/UNIQUE|unique|constraint/i.test(String(err?.message || err))) {
        const raced = await getUserByWallet(key)
        if (raced) return raced
      }
      throw err
    }
    await stampUserLotsWallet(userId, key)
    return getUserById(userId)
  }
  if (curW.toLowerCase() === key.toLowerCase()) {
    await stampUserLotsWallet(userId, key)
    return current
  }

  const fresh = await getOrCreateUser(newGuestKey())
  try {
    await getDb().execute({
      sql: 'UPDATE users SET wallet_pubkey = ? WHERE id = ?',
      args: [key, fresh.id],
    })
  } catch (err) {
    if (/UNIQUE|unique|constraint/i.test(String(err?.message || err))) {
      const raced = await getUserByWallet(key)
      if (raced) return raced
    }
    throw err
  }
  await stampUserLotsWallet(fresh.id, key)
  return getUserById(fresh.id)
}

export async function unlinkWallet(userId) {
  await migrate()
  const current = await getUserById(userId)
  await stampUserLotsWallet(userId, current?.wallet_pubkey)
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
  const sameSite = String(process.env.COOKIE_SAMESITE || 'Lax').trim()
  if (!/^(?:Lax|Strict|None)$/i.test(sameSite)) {
    throw new Error('COOKIE_SAMESITE must be Lax, Strict, or None')
  }
  if (sameSite.toLowerCase() === 'none' && !secure) {
    throw new Error('SameSite=None requires HTTPS')
  }
  const parts = [
    `void_sid=${encodeURIComponent(`${guestKey}.${signSessionGuestKey(guestKey)}`)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function resolveGuestKey(req, _bodyGuestKey) {
  const cookies = parseCookies(req)
  const fromCookie = verifiedSessionGuestKey(cookies.void_sid)
  return (
    fromCookie ||
    newGuestKey()
  )
}

export function fingerprintSession(guestKey) {
  return createHash('sha256').update(String(guestKey)).digest('hex').slice(0, 12)
}
