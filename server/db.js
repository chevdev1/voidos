import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'void.db')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ownerships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      constel_id TEXT NOT NULL,
      constel_name TEXT NOT NULL,
      claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, constel_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ownerships_constel ON ownerships(constel_id);

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      trigger_when TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, key)
    );
  `)
}

export function seedPromptsFromShared() {
  const sharedPath = path.join(__dirname, '..', 'shared', 'mind-prompts.json')
  if (!fs.existsSync(sharedPath)) return false
  const prompts = JSON.parse(fs.readFileSync(sharedPath, 'utf8'))
  if (!Array.isArray(prompts) || !prompts.length) return false
  db.exec('DELETE FROM prompts')
  const insert = db.prepare(
    `INSERT INTO prompts (slug, kind, trigger_when, priority, body, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
  )
  db.exec('BEGIN')
  try {
    for (const p of prompts) {
      insert.run(p.slug, p.kind, p.trigger_when, p.priority || 0, p.body)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  console.log(`[void-db] seeded ${prompts.length} prompts from shared/mind-prompts.json`)
  return true
}

export function seedPrompts() {
  if (seedPromptsFromShared()) return
  const sqlPath = path.join(__dirname, 'seed-prompts.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  db.exec(sql)
  const n = db.prepare('SELECT COUNT(*) AS c FROM prompts').get().c
  console.log(`[void-db] seeded prompts → ${n} rows (sql)`)
}

export function ensureSeeded() {
  migrate()
  const n = db.prepare('SELECT COUNT(*) AS c FROM prompts').get().c
  if (n === 0) seedPrompts()
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  migrate()
  if (process.argv.includes('--seed')) seedPrompts()
  else ensureSeeded()
  console.log(`[void-db] ready at ${dbPath}`)
}
