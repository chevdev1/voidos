// The desktop's own file system: folders and text files kept on this device (localStorage).
// A tree of nodes: { type: 'dir', children: { name: node } } or { type: 'file', text }.
// Pure helpers, so the same rules run in the app and in tests.
import { nameError } from '../code/files.js'

export const FILES_KEY = 'void-files'

export const DEFAULT_TREE = {
  type: 'dir',
  children: {
    Documents: {
      type: 'dir',
      children: {
        'Welcome.txt': { type: 'file', text: 'Welcome to VOID.OS files.\n\nCreate folders and text files here. Everything stays on this device.\n' },
      },
    },
    Projects: { type: 'dir', children: {} },
  },
}

export function clone(tree) {
  return JSON.parse(JSON.stringify(tree))
}

export function loadTree(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(FILES_KEY) || 'null')
    if (v && v.type === 'dir' && v.children && typeof v.children === 'object') return v
  } catch {
    /* damaged store: fall back to the default */
  }
  return clone(DEFAULT_TREE)
}

export function saveTree(tree, storage = globalThis.localStorage) {
  try {
    storage.setItem(FILES_KEY, JSON.stringify(tree))
    return true
  } catch {
    return false
  }
}

// The node at `path` (an array of folder names), or null when it does not exist or is not a folder.
export function nodeAt(tree, path) {
  let node = tree
  for (const seg of path) {
    if (!node || node.type !== 'dir' || !Object.prototype.hasOwnProperty.call(node.children, seg)) return null
    node = node.children[seg]
  }
  return node
}

export function listDir(tree, path) {
  const dir = nodeAt(tree, path)
  if (!dir || dir.type !== 'dir') return []
  return Object.keys(dir.children)
    .sort((a, b) => {
      const da = dir.children[a].type === 'dir' ? 0 : 1
      const db = dir.children[b].type === 'dir' ? 0 : 1
      return da - db || a.localeCompare(b)
    })
    .map((name) => ({ name, type: dir.children[name].type }))
}

// Returns a new tree with `fn` applied to the folder at `path`. The original tree is never mutated.
function withDir(tree, path, fn) {
  const next = clone(tree)
  const dir = nodeAt(next, path)
  if (!dir || dir.type !== 'dir') return null
  fn(dir)
  return next
}

// Creates a folder or a file in `path`. Returns { tree, error }.
export function create(tree, path, name, type) {
  const err = nameError(name)
  if (err) return { tree, error: err }
  const clean = name.trim()
  const dir = nodeAt(tree, path)
  if (!dir || dir.type !== 'dir') return { tree, error: 'That folder does not exist.' }
  if (Object.prototype.hasOwnProperty.call(dir.children, clean)) return { tree, error: 'Something with that name already exists here.' }
  const next = withDir(tree, path, (d) => {
    d.children[clean] = type === 'dir' ? { type: 'dir', children: {} } : { type: 'file', text: '' }
  })
  return { tree: next, error: null }
}

export function removeEntry(tree, path, name) {
  return withDir(tree, path, (d) => {
    delete d.children[name]
  }) ?? tree
}

export function writeFile(tree, path, name, text) {
  return withDir(tree, path, (d) => {
    const f = d.children[name]
    if (f && f.type === 'file') f.text = String(text)
  }) ?? tree
}

export function readFile(tree, path, name) {
  const dir = nodeAt(tree, path)
  const f = dir && dir.type === 'dir' ? dir.children[name] : null
  return f && f.type === 'file' ? f.text : null
}

export function crumbsOf(path) {
  return ['Desktop', ...path]
}
