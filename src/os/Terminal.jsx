import { useEffect, useRef, useState } from 'react'
import { setProtection, getProtection } from './protection.js'
import { MatrixRain } from './MatrixRain.jsx'
import { loadTrending } from './useTrending.js'
import { formatCompactUsd, formatPercent } from './lib.js'

const BOOT = [
  'VOID.OS kernel 0.9.3-demo',
  'loading constellations ........ ok',
  'mounting wallet bridge ........ ok',
  'tor: simulated (no real circuit in this build)',
  '',
  'type  help  to list commands',
]

const HELP = [
  'help              this list',
  'market            trending tokens on Robinhood Chain',
  'wallet            wallet status',
  'vpn on | off      open the VPN panel',
  'ai <question>     ask VOID.AI (pretest)',
  'ssh <host>        connect to a host (simulated)',
  'matrix            you know what this does',
  'neofetch          system summary',
  'clear             clear the screen',
]

const REMOTE = {
  ls: ['motd  notes.txt  wallets/  .ssh/', ''],
  whoami: ['guest'],
  'uname -a': ['Linux void-lab-01 6.8.0-void #1 SMP x86_64 GNU/Linux'],
  uptime: [' 03:41:07 up 12 days, 4:02,  1 user,  load average: 0.08, 0.11, 0.09'],
  'cat motd': [
    '┌─ VOID LAB ───────────────────────────────┐',
    '│ this is a simulated host for the demo.   │',
    '│ real SSH runs through the native build.  │',
    '└──────────────────────────────────────────┘',
  ],
  'cat notes.txt': ['todo: rotate keys, check relay list, stop trusting the wifi.'],
}

const SSH_STAGES = [
  ['dim', 'resolving host ........................ ok'],
  ['dim', 'tcp 22 open ........................... ok'],
  ['dim', 'kex curve25519-sha256 ................. ok'],
  ['dim', 'host key ed25519 SHA256:VoidDemoKey...  accepted (demo)'],
  ['dim', 'auth publickey ........................ ok'],
  ['dim', 'pty allocated ......................... ok'],
]

let uid = 0
const line = (kind, text) => ({ id: ++uid, kind, text })

export function Terminal({ payload, onOpen }) {
  const [lines, setLines] = useState(() => [])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState({ kind: 'local' })
  // An SSH session counts as protection while it is open.
  useEffect(() => {
    if (mode.kind === 'ssh') setProtection('ssh')
    else if (getProtection() === 'ssh') setProtection('off')
  }, [mode.kind])
  useEffect(() => () => {
    if (getProtection() === 'ssh') setProtection('off')
  }, [])
  const [busy, setBusy] = useState(false)
  const [matrix, setMatrix] = useState(null)
  const scroller = useRef(null)
  const inputRef = useRef(null)
  const timers = useRef([])
  const history = useRef([])
  const cursor = useRef(-1)

  const schedule = (fn, ms) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }

  // Boot: type the banner in, one line at a time.
  useEffect(() => {
    const pending = timers.current
    BOOT.forEach((text, i) => schedule(() => setLines((l) => [...l, line('out', text)]), 180 + i * 210))
    return () => {
      pending.forEach(clearTimeout)
    }
  }, [])

  // Opened from the browser's SSH list: connect straight away.
  useEffect(() => {
    if (payload?.ssh) connectSsh(payload.ssh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.nonce])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  function connectSsh(host) {
    setBusy(true)
    setLines((l) => [...l, line('cmd', `ssh ${host}`)])
    setMatrix({ label: `connecting to ${host}`, host })
    SSH_STAGES.forEach(([kind, text], i) => schedule(() => setLines((l) => [...l, line(kind, text)]), 260 + i * 240))
  }

  function onMatrixDone() {
    const host = matrix?.host
    setMatrix(null)
    if (host) {
      setMode({ kind: 'ssh', host })
      setLines((l) => [...l, line('ok', `connected. welcome to ${host}`), line('dim', '')])
    }
    setBusy(false)
  }

  async function runLocal(raw) {
    const [cmd, ...rest] = raw.split(' ')
    const arg = rest.join(' ').trim()
    const out = (...texts) => setLines((l) => [...l, ...texts.map((t) => line(t.kind || 'out', t.text ?? t))])

    switch (cmd) {
      case '':
        return
      case 'help':
        return out(...HELP.map((t) => ({ text: t })))
      case 'clear':
        setLines([])
        return
      case 'whoami':
        return out({ text: 'guest · anonymous session (no account)' })
      case 'date':
        return out({ text: new Date().toString() })
      case 'wallet':
        return out({ kind: 'dim', text: 'no wallet linked. open Wallet to connect one.' })
      case 'neofetch':
        return out(
          { kind: 'ok', text: '   ◎  VOID.OS 0.9.3-demo' },
          { text: '      host: this browser tab' },
          { text: '    shell: terminal (cinematic build)' },
          { text: '   network: robinhood-chain 4663' },
          { text: '     tunnel: simulated' },
        )
      case 'matrix':
        setMatrix({ label: 'wake up, neo', host: null })
        return
      case 'vpn':
        if (arg !== 'on' && arg !== 'off') return out({ kind: 'err', text: 'usage: vpn on | off' })
        onOpen?.('vpn', { want: arg })
        return out({ kind: 'dim', text: `vpn ${arg}: opening panel…` })
      case 'ai':
        if (!arg) return out({ kind: 'err', text: 'usage: ai <question>' })
        onOpen?.('ai', { query: arg })
        return out({ kind: 'dim', text: 'handing the question to VOID.AI (pretest)…' })
      case 'ssh':
        if (!arg) return out({ kind: 'err', text: 'usage: ssh <host>' })
        return connectSsh(arg)
      case 'market': {
        setBusy(true)
        out({ kind: 'dim', text: 'fetching trending pools…' })
        const { rows, source } = await loadTrending()
        const top = [...rows].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 5)
        out(
          { kind: 'dim', text: `source: ${source}` },
          ...top.map((t) => ({ text: `${t.symbol.padEnd(10)} ${formatPercent(t.change24h).padStart(9)}   ${formatCompactUsd(t.volume24h)}` })),
        )
        setBusy(false)
        return
      }
      default:
        return out({ kind: 'err', text: `${cmd}: command not found. try help` })
    }
  }

  function runRemote(raw) {
    const out = (...texts) => setLines((l) => [...l, ...texts.map((t) => line(t.kind || 'out', t.text ?? t))])
    if (raw === 'exit' || raw === 'logout') {
      setMode({ kind: 'local' })
      return out({ kind: 'dim', text: `connection to ${mode.host} closed.` })
    }
    if (raw === 'help') return out({ text: 'remote: ls, whoami, uname -a, uptime, cat motd, exit' })
    const res = REMOTE[raw]
    if (res) return out(...res.map((t) => ({ text: t })))
    return out({ kind: 'err', text: `bash: ${raw}: command not found` })
  }

  function submit(e) {
    e.preventDefault()
    if (busy) return
    const raw = input.trim()
    setInput('')
    if (raw) history.current = [raw, ...history.current].slice(0, 50)
    cursor.current = -1
    if (mode.kind === 'ssh') {
      setLines((l) => [...l, line('cmd', `root@${mode.host}:~$ ${raw}`)])
      return runRemote(raw)
    }
    setLines((l) => [...l, line('cmd', `guest@void:~$ ${raw}`)])
    runLocal(raw)
  }

  function onKeyDown(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const h = history.current
    if (!h.length) return
    cursor.current = Math.max(-1, Math.min(h.length - 1, cursor.current + (e.key === 'ArrowUp' ? 1 : -1)))
    setInput(cursor.current === -1 ? '' : h[cursor.current])
  }

  const prompt = mode.kind === 'ssh' ? `root@${mode.host}:~$` : 'guest@void:~$'

  return (
    <div className={`os-term ${mode.kind === 'ssh' ? 'is-ssh' : ''}`} onClick={() => inputRef.current?.focus()}>
      <div className="os-term-scan" aria-hidden="true" />
      <div className="os-term-out" ref={scroller} aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className={`os-term-line os-term-${l.kind}`}>
            {l.text || ' '}
          </div>
        ))}
      </div>
      <form className="os-term-form" onSubmit={submit}>
        <span className="os-term-prompt">{prompt}</span>
        <input
          ref={inputRef}
          className="os-term-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminal input"
        />
      </form>
      {matrix && <MatrixRain label={matrix.label} onDone={onMatrixDone} duration={matrix.host ? 2200 : 2000} />}
    </div>
  )
}
