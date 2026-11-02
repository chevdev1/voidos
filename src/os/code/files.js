// VOID.CODE project model. Files and folders live in this browser's localStorage. Pure helpers, no DOM.
// A project is { files: { 'src/index.js': text }, folders: ['src', 'src/lib'] }. Folders can be empty.
export const STORE_KEY = 'void-code-files'

// The demo project. Kept self-contained: the sandbox runs single files, so nothing here imports another file.
export const DEMO_FILES = {
  'README.md': '# void-lab\n\nA tiny project for the VOID.CODE demo.\n\nOpen a JavaScript file and press Ctrl+Enter to run it in the sandbox.\n',
  'package.json': JSON.stringify({ name: 'void-lab', version: '0.1.0', private: true }, null, 2) + '\n',
  'src/index.js': [
    '// Runs in a sandbox: no DOM, no storage, no wallet.',
    'function format(n) {',
    "  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 })",
    '}',
    '',
    'const tokens = [',
    "  { symbol: 'NOVA', price: 0.0421 },",
    "  { symbol: 'LYRA', price: 1.92 },",
    ']',
    '',
    'for (const t of tokens) {',
    '  console.log(t.symbol, format(t.price))',
    '}',
    '',
  ].join('\n'),
  'src/market.js': '// Demo data, not live.\nexport const tokens = [\n  { symbol: "NOVA", price: 0.0421 },\n  { symbol: "LYRA", price: 1.92 },\n]\n',
  'src/format.js': 'export function format(n) {\n  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 })\n}\n',
}
export const DEMO_FOLDERS = ['src', 'docs']

const clone = (p) => ({ files: { ...p.files }, folders: [...p.folders] })

export function demoProject() {
  return clone({ files: DEMO_FILES, folders: DEMO_FOLDERS })
}

// Reads the store. Accepts the new shape, and the old flat map of files, so nothing is lost on upgrade.
export function loadProject(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(STORE_KEY) || 'null')
    if (raw && typeof raw === 'object') {
      if (raw.files && typeof raw.files === 'object' && Object.values(raw.files).every((v) => typeof v === 'string')) {
        const folders = Array.isArray(raw.folders) ? raw.folders.filter((f) => typeof f === 'string') : []
        return { files: { ...raw.files }, folders: [...new Set(folders)] }
      }
      if (Object.values(raw).every((v) => typeof v === 'string')) {
        return { files: { ...raw }, folders: [] } // the old flat format
      }
    }
  } catch {
    /* corrupt or blocked storage: fall through to the demo */
  }
  return demoProject()
}

export function saveProject(project, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify({ v: 2, files: project.files, folders: project.folders }))
    return true
  } catch {
    return false
  }
}

export function resetProject(storage = globalThis.localStorage) {
  try {
    storage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
  return demoProject()
}

export function languageFor(path) {
  if (/\.js$/i.test(path)) return 'js'
  if (/\.json$/i.test(path)) return 'json'
  if (/\.md$/i.test(path)) return 'md'
  return 'text'
}

export function isRunnable(path) {
  return /\.js$/i.test(path)
}

export function parentDir(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

export function baseName(path) {
  return path.split('/').pop()
}

export function joinPath(dir, name) {
  return dir ? `${dir}/${name}` : name
}

// A name is one path segment: no slashes, no dots-only, no control characters, not too long.
export function nameError(name) {
  const n = String(name || '').trim()
  if (!n) return 'Give it a name.'
  if (n.length > 60) return 'Keep names under 60 characters.'
  if (/[\\/:*?"<>|]/.test(n)) return 'Names cannot contain \\ / : * ? " < > |'
  if (/^\.+$/.test(n)) return 'That name is reserved.'
  if ([...n].some((c) => c.charCodeAt(0) < 32)) return 'Names cannot contain control characters.'
  return null
}

// Every folder that exists: the explicit ones plus any folder implied by a file path.
export function allFolders(project) {
  const set = new Set(project.folders)
  for (const path of Object.keys(project.files)) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join('/'))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

// Visible rows for the explorer: folders first at each level, then files, indented. Closed folders hide their contents.
export function treeRows(project, expanded) {
  const folders = allFolders(project)
  const rows = []
  const walk = (dir, depth) => {
    const subFolders = folders.filter((f) => parentDir(f) === dir)
    const files = Object.keys(project.files)
      .filter((p) => parentDir(p) === dir)
      .sort((a, b) => baseName(a).localeCompare(baseName(b)))
    for (const f of subFolders) {
      const open = expanded.has(f)
      rows.push({ kind: 'dir', name: baseName(f), path: f, depth, open })
      if (open) walk(f, depth + 1)
    }
    for (const p of files) rows.push({ kind: 'file', name: baseName(p), path: p, depth })
  }
  walk('', 0)
  return rows
}

// Every path that is `path` itself or sits inside it.
const inside = (p, path) => p === path || p.startsWith(`${path}/`)

export function addFile(project, path) {
  if (project.files[path] !== undefined) return project
  return { files: { ...project.files, [path]: '' }, folders: project.folders }
}

export function addFolder(project, path) {
  if (allFolders(project).includes(path)) return project
  return { files: project.files, folders: [...project.folders, path] }
}

// Renames a file or a folder (and everything inside it). Returns the new project.
export function renamePath(project, path, newPath) {
  const files = {}
  for (const [p, text] of Object.entries(project.files)) {
    files[inside(p, path) ? newPath + p.slice(path.length) : p] = text
  }
  const folders = project.folders.map((f) => (inside(f, path) ? newPath + f.slice(path.length) : f))
  return { files, folders: [...new Set(folders)] }
}

// Removes a file, or a folder with everything in it. Returns the new project.
export function removePath(project, path) {
  const files = {}
  for (const [p, text] of Object.entries(project.files)) if (!inside(p, path)) files[p] = text
  const folders = project.folders.filter((f) => !inside(f, path))
  return { files, folders }
}

export function lineCount(text) {
  return text === '' ? 1 : text.split('\n').length
}

// Breadcrumb segments for a path: ['src', 'index.js'].
export function crumbs(path) {
  return path ? path.split('/') : []
}
