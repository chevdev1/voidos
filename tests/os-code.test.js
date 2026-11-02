import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadProject, saveProject, resetProject, demoProject, languageFor, isRunnable, treeRows,
  nameError, addFile, addFolder, renamePath, removePath, allFolders, parentDir, joinPath, crumbs, DEMO_FILES, STORE_KEY,
} from '../src/os/code/files.js'
import { detectSecrets } from '../src/os/code/secrets.js'
import { filterPalette, runCommand, PALETTE } from '../src/os/code/commands.js'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

test('loadProject: demo when empty, new shape kept, old flat map upgraded', () => {
  assert.deepEqual(loadProject(memory()).files, DEMO_FILES)
  const s = memory()
  saveProject({ files: { 'a/b.js': 'x' }, folders: ['a', 'empty'] }, s)
  const p = loadProject(s)
  assert.deepEqual(p.files, { 'a/b.js': 'x' })
  assert.deepEqual(p.folders, ['a', 'empty'])
  const old = memory()
  old.setItem(STORE_KEY, JSON.stringify({ 'one.js': '1' }))
  assert.deepEqual(loadProject(old), { files: { 'one.js': '1' }, folders: [] })
  const bad = memory()
  bad.setItem(STORE_KEY, '{nope')
  assert.deepEqual(loadProject(bad).files, DEMO_FILES)
})

test('resetProject returns the demo and clears storage', () => {
  const s = memory()
  saveProject({ files: { 'x.js': '' }, folders: [] }, s)
  assert.deepEqual(resetProject(s).files, demoProject().files)
  assert.equal(s.getItem(STORE_KEY), null)
})

test('language and runnable checks use the extension', () => {
  assert.equal(languageFor('src/index.js'), 'js')
  assert.equal(languageFor('package.json'), 'json')
  assert.equal(languageFor('README.md'), 'md')
  assert.equal(languageFor('notes.txt'), 'text')
  assert.equal(isRunnable('a/b.js'), true)
  assert.equal(isRunnable('README.md'), false)
})

test('nameError rejects bad segments and accepts normal names', () => {
  assert.ok(nameError(''))
  assert.ok(nameError('a/b'))
  assert.ok(nameError('..'))
  assert.ok(nameError('x'.repeat(61)))
  assert.ok(nameError('bad\u0007name'))
  assert.equal(nameError('notes.md'), null)
  assert.equal(nameError('  spaced name.js  '), null)
})

test('treeRows shows folders first, hides the contents of closed folders', () => {
  const project = { files: { 'src/a.js': '', 'README.md': '', 'src/lib/b.js': '' }, folders: ['docs'] }
  const closed = treeRows(project, new Set())
  assert.deepEqual(closed.map((r) => `${r.kind}:${r.path}`), ['dir:docs', 'dir:src', 'file:README.md'])
  const open = treeRows(project, new Set(['src']))
  assert.deepEqual(open.map((r) => `${r.kind}:${r.path}`), ['dir:docs', 'dir:src', 'dir:src/lib', 'file:src/a.js', 'file:README.md'])
  assert.equal(open.find((r) => r.path === 'src/a.js').depth, 1)
})

test('addFile and addFolder are idempotent', () => {
  let p = { files: {}, folders: [] }
  p = addFile(p, 'notes/todo.md')
  assert.equal(p.files['notes/todo.md'], '')
  assert.ok(allFolders(p).includes('notes'))
  p = addFolder(p, 'notes')
  p = addFolder(p, 'notes')
  assert.equal(allFolders(p).filter((f) => f === 'notes').length, 1)
  assert.equal(addFile(p, 'notes/todo.md'), p)
})

test('renamePath moves a file, and a folder with everything inside it', () => {
  const p = { files: { 'src/a.js': '1', 'src/lib/b.js': '2', 'top.js': '3' }, folders: ['src', 'src/lib', 'spare'] }
  const renamed = renamePath(p, 'src', 'code')
  assert.equal(renamed.files['code/a.js'], '1')
  assert.equal(renamed.files['code/lib/b.js'], '2')
  assert.equal(renamed.files['top.js'], '3')
  assert.ok(renamed.folders.includes('code/lib'))
  assert.ok(renamed.folders.includes('spare'))
  const file = renamePath(p, 'top.js', 'main.js')
  assert.equal(file.files['main.js'], '3')
})

test('removePath deletes a file, or a folder with everything in it', () => {
  const p = { files: { 'src/a.js': '1', 'src/lib/b.js': '2', 'top.js': '3' }, folders: ['src', 'src/lib'] }
  const dir = removePath(p, 'src')
  assert.deepEqual(Object.keys(dir.files), ['top.js'])
  assert.deepEqual(dir.folders, [])
  const one = removePath(p, 'top.js')
  assert.ok(!one.files['top.js'])
  assert.ok(one.files['src/a.js'])
})

test('paths: parentDir, joinPath and crumbs', () => {
  assert.equal(parentDir('src/lib/x.js'), 'src/lib')
  assert.equal(parentDir('x.js'), '')
  assert.equal(joinPath('', 'x.js'), 'x.js')
  assert.equal(joinPath('src', 'x.js'), 'src/x.js')
  assert.deepEqual(crumbs('src/lib/x.js'), ['src', 'lib', 'x.js'])
})

test('detectSecrets flags key-like text and stays quiet on normal code', () => {
  assert.equal(detectSecrets('-----BEGIN PRIVATE KEY-----\nabc').length, 1)
  assert.equal(detectSecrets('const k = "0x' + 'a'.repeat(64) + '"').length, 1)
  assert.equal(detectSecrets('apple river stone cloud maple tiger honey bread ocean lemon candle magic').length, 1)
  assert.deepEqual(detectSecrets(DEMO_FILES['src/index.js']), [])
  assert.deepEqual(detectSecrets('0x' + 'a'.repeat(40)), [])
})

test('filterPalette matches labels and ids', () => {
  assert.equal(filterPalette('').length, PALETTE.length)
  assert.deepEqual(filterPalette('run').map((c) => c.id), ['run'])
  assert.deepEqual(filterPalette('zzz'), [])
})

test('runCommand: help, ls, cat, run, mkdir, touch, rm and errors', () => {
  const files = { 'a.js': 'one\ntwo', 'notes.md': '# hi' }
  assert.ok(runCommand('help', files).lines.length > 5)
  assert.deepEqual(runCommand('ls', files).lines.map((l) => l.text), ['a.js', 'notes.md'])
  assert.deepEqual(runCommand('cat a.js', files).lines.map((l) => l.text), ['one', 'two'])
  assert.equal(runCommand('run a.js', files).action.path, 'a.js')
  assert.equal(runCommand('run notes.md', files).lines[0].kind, 'err')
  assert.equal(runCommand('mkdir docs/new', files).action.type, 'mkdir')
  assert.equal(runCommand('touch x.md', files).action.path, 'x.md')
  assert.equal(runCommand('rm a.js', files).action.type, 'rm')
  assert.equal(runCommand('rm', files).lines[0].kind, 'err')
  assert.equal(runCommand('rm -rf /', files).action.type, 'rm') // the host finds no such path and reports it
  assert.equal(runCommand('', files).lines.length, 0)
})
