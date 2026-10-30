// Command palette list and filter, plus the terminal command parser. Both are pure.
export const PALETTE = [
  { id: 'save', label: 'Save file', keys: 'Ctrl+S' },
  { id: 'run', label: 'Run active file', keys: 'Ctrl+Enter' },
  { id: 'terminal', label: 'Toggle terminal', keys: 'Ctrl+`' },
  { id: 'sidebar', label: 'Toggle sidebar', keys: 'Ctrl+B' },
  { id: 'close', label: 'Close tab', keys: 'Ctrl+W' },
  { id: 'reset', label: 'Reset demo project' },
]

export function filterPalette(query, list = PALETTE) {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q))
}

const HELP = [
  'help              this list',
  'ls                list project files',
  'cat <file>        print a file (first 40 lines)',
  'run <file>        run a .js file in the sandbox',
  'clear             clear the panel',
]

// Returns the lines to print and an optional action for the host to perform.
// `files` is the current text of every file, keyed by path.
export function runCommand(input, files) {
  const line = String(input || '').trim()
  if (!line) return { lines: [] }
  const [cmd, ...rest] = line.split(/\s+/)
  const arg = rest.join(' ')

  switch (cmd) {
    case 'help':
      return { lines: HELP.map((text) => ({ kind: 'out', text })) }
    case 'ls':
      return { lines: Object.keys(files).sort().map((text) => ({ kind: 'out', text })) }
    case 'cat': {
      if (!arg) return { lines: [{ kind: 'err', text: 'usage: cat <file>' }] }
      if (!(arg in files)) return { lines: [{ kind: 'err', text: `cat: ${arg}: no such file` }] }
      const body = files[arg].split('\n').slice(0, 40).map((text) => ({ kind: 'out', text }))
      return { lines: body }
    }
    case 'run':
      if (!arg) return { lines: [{ kind: 'err', text: 'usage: run <file>' }] }
      if (!(arg in files)) return { lines: [{ kind: 'err', text: `run: ${arg}: no such file` }] }
      if (!/\.js$/i.test(arg)) return { lines: [{ kind: 'err', text: 'run: only .js files can run' }] }
      return { lines: [], action: { type: 'run', path: arg } }
    case 'clear':
      return { lines: [], action: { type: 'clear' } }
    default:
      return { lines: [{ kind: 'err', text: `${cmd}: command not found. try help` }] }
  }
}
