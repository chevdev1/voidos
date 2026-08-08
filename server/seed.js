/**
 * Reseed prompts table from shared/mind-prompts.json (source of truth for Vercel + local).
 * Usage: node --experimental-sqlite seed.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate, db } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedPath = path.join(__dirname, '..', 'shared', 'mind-prompts.json')

migrate()

const prompts = JSON.parse(fs.readFileSync(sharedPath, 'utf8'))
if (!Array.isArray(prompts) || !prompts.length) {
  console.error('shared/mind-prompts.json is empty or invalid')
  process.exit(1)
}

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
console.log(`Reseeded ${prompts.length} prompts from shared/mind-prompts.json`)
