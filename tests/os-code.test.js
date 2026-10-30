import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadFiles, saveFiles, resetFiles, languageFor, isRunnable, treeRows, DEMO_FILES, STORE_KEY } from '../src/os/code/files.js'
import { detectSecrets } from '../src/os/code/secrets.js'
import { filterPalette, runCommand, PALETTE } from '../src/os/code/commands.js'

// minimal in-memory storage with the same surface as localStorage
const memory = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

test('loadFiles falls back to the demo when storage is empty or corrupt', () => {
  assert.deepEqual(loadFiles(memory()), DEMO_FILES)
  const bad = memory()
  bad.setItem(STORE_KEY, '{not json')
  assert.deepEqual(loadFiles(bad), DEMO_FILES)
  const wrongShape = memory()
  wrongShape.setItem(STORE_KEY, JSON.stringify({ a: 1 }))
  assert.deepEqual(loadFiles(wrongShape), DEMO_FILES)
})

test('saveFiles then loadFiles round-trips, and resetFiles restores the demo', () => {
  const s = memory()
  saveFiles({ 'a.js': 'x' }, s)
  assert.deepEqual(loadFiles(s), { 'a.js': 'x' })
  assert.deepEqual(resetFiles(s), DEMO_FILES)
  assert.deepEqual(loadFiles(s), DEMO_FILES)
})

test('languageFor and isRunnable use the extension', () => {
  assert.equal(languageFor('src/index.js'), 'js')
  assert.equal(languageFor('package.json'), 'json')
  assert.equal(languageFor('README.md'), 'md')
  assert.equal(languageFor('notes.txt'), 'text')
  assert.equal(isRunnable('src/index.js'), true)
  assert.equal(isRunnable('README.md'), false)
})

test('treeRows lists folders before their files, indented by depth', () => {
  const rows = treeRows(['src/b.js', 'README.md', 'src/a.js'])
  const names = rows.map((r) => `${r.kind}:${r.name}:${r.depth}`)
  assert.deepEqual(names, ['file:README.md:0', 'dir:src:0', 'file:a.js:1', 'file:b.js:1'])
})

test('detectSecrets flags private key blocks, 32-byte hex and seed-like lines', () => {
  assert.equal(detectSecrets('-----BEGIN PRIVATE KEY-----\nabc').length, 1)
  assert.equal(detectSecrets('const k = "0x' + 'a'.repeat(64) + '"').length, 1)
  const seed = 'apple river stone cloud maple tiger honey bread ocean lemon candle magic'
  assert.equal(detectSecrets(seed).length, 1)
})

test('detectSecrets stays quiet on normal code and prose', () => {
  assert.deepEqual(detectSecrets(DEMO_FILES['src/index.js']), [])
  assert.deepEqual(detectSecrets('This is a normal sentence about a small project in the browser today.'), [])
  assert.deepEqual(detectSecrets('0x' + 'a'.repeat(40)), []) // an address is public, not a key
})

test('filterPalette matches labels and ids, empty query returns everything', () => {
  assert.equal(filterPalette('').length, PALETTE.length)
  assert.deepEqual(filterPalette('run').map((c) => c.id), ['run'])
  assert.deepEqual(filterPalette('zzz'), [])
})

test('runCommand: help, ls, cat, run and errors', () => {
  const files = { 'a.js': 'one\ntwo', 'notes.md': '# hi' }
  assert.ok(runCommand('help', files).lines.length > 3)
  assert.deepEqual(runCommand('ls', files).lines.map((l) => l.text), ['a.js', 'notes.md'])
  assert.deepEqual(runCommand('cat a.js', files).lines.map((l) => l.text), ['one', 'two'])
  assert.equal(runCommand('run a.js', files).action.path, 'a.js')
  assert.equal(runCommand('run notes.md', files).lines[0].kind, 'err')
  assert.equal(runCommand('run missing.js', files).lines[0].kind, 'err')
  assert.equal(runCommand('rm -rf /', files).lines[0].kind, 'err')
  assert.equal(runCommand('', files).lines.length, 0)
})
