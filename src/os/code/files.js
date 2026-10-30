// Project files for VOID.CODE. Everything is local: the store is this browser's localStorage.
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

export function loadFiles(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(STORE_KEY) || 'null')
    if (raw && typeof raw === 'object' && Object.values(raw).every((v) => typeof v === 'string')) {
      return { ...raw }
    }
  } catch {
    /* corrupt or blocked storage: fall through to the demo */
  }
  return { ...DEMO_FILES }
}

export function saveFiles(files, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(files))
    return true
  } catch {
    return false
  }
}

export function resetFiles(storage = globalThis.localStorage) {
  try {
    storage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
  return { ...DEMO_FILES }
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

// Flat rows for the explorer, sorted by path. A folder row appears before the files inside it.
export function treeRows(paths) {
  const rows = []
  const seenDirs = new Set()
  const sorted = [...paths].sort((a, b) => a.localeCompare(b))
  for (const path of sorted) {
    const parts = path.split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/')
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir)
        rows.push({ kind: 'dir', name: parts[i], path: dir, depth: i })
      }
    }
    rows.push({ kind: 'file', name: parts[parts.length - 1], path, depth: parts.length - 1 })
  }
  return rows
}

export function lineCount(text) {
  return text === '' ? 1 : text.split('\n').length
}
