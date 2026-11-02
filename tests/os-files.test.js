import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_TREE, clone, nodeAt, listDir, create, removeEntry, writeFile, readFile, loadTree, saveTree, FILES_KEY } from '../src/os/files/store.js'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

test('default desktop has the two folders, and the welcome file', () => {
  assert.deepEqual(listDir(DEFAULT_TREE, []).map((e) => e.name), ['Documents', 'Projects'])
  assert.equal(readFile(DEFAULT_TREE, ['Documents'], 'Welcome.txt').startsWith('Welcome'), true)
})

test('folders list first, then files, both alphabetically', () => {
  let t = clone(DEFAULT_TREE)
  t = create(t, ['Documents'], 'zeta', 'dir').tree
  t = create(t, ['Documents'], 'alpha.txt', 'file').tree
  assert.deepEqual(listDir(t, ['Documents']).map((e) => e.name), ['zeta', 'alpha.txt', 'Welcome.txt'])
})

test('create adds a folder or file, and refuses duplicates and bad names', () => {
  const r = create(DEFAULT_TREE, ['Projects'], 'site', 'dir')
  assert.equal(r.error, null)
  assert.equal(nodeAt(r.tree, ['Projects', 'site']).type, 'dir')
  assert.ok(create(r.tree, ['Projects'], 'site', 'dir').error)
  assert.ok(create(DEFAULT_TREE, ['Projects'], 'a/b', 'file').error)
  assert.ok(create(DEFAULT_TREE, ['Missing'], 'x', 'file').error)
})

test('create never mutates the tree it was given', () => {
  const before = JSON.stringify(DEFAULT_TREE)
  create(DEFAULT_TREE, ['Documents'], 'new.txt', 'file')
  assert.equal(JSON.stringify(DEFAULT_TREE), before)
})

test('writeFile and readFile keep text; removeEntry deletes a folder with its contents', () => {
  let t = create(DEFAULT_TREE, ['Projects'], 'notes.txt', 'file').tree
  t = writeFile(t, ['Projects'], 'notes.txt', 'hello')
  assert.equal(readFile(t, ['Projects'], 'notes.txt'), 'hello')
  t = create(t, ['Projects'], 'site', 'dir').tree
  t = create(t, ['Projects', 'site'], 'index.html', 'file').tree
  t = removeEntry(t, ['Projects'], 'site')
  assert.equal(nodeAt(t, ['Projects', 'site']), null)
  assert.equal(readFile(t, ['Projects'], 'notes.txt'), 'hello')
})

test('loadTree and saveTree round-trip, and a damaged store falls back to the default', () => {
  const s = memory()
  const t = create(DEFAULT_TREE, ['Documents'], 'x.txt', 'file').tree
  saveTree(t, s)
  assert.deepEqual(loadTree(s), t)
  s.setItem(FILES_KEY, '{not json')
  assert.deepEqual(loadTree(s), DEFAULT_TREE)
})
