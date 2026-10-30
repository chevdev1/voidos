import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_FILES, loadFiles, saveFiles, resetFiles, languageFor, isRunnable, treeRows, lineCount } from './files.js'
import { detectSecrets } from './secrets.js'
import { filterPalette, runCommand } from './commands.js'
import { runInSandbox } from './runner.js'
import { FilesIcon, InspectorIcon, PlayIcon, SettingsIcon, TerminalIcon, CloseIcon } from '../icons.jsx'

const MAX_LINES = 300
const basename = (p) => p.split('/').pop()

export function CodeApp({ prefs }) {
  // Text lives in a ref while typing, so keystrokes do not re-render the window.
  const [initial] = useState(loadFiles)
  const texts = useRef({ ...initial })
  const [paths, setPaths] = useState(() => Object.keys(initial))
  const [open, setOpen] = useState([])
  const [active, setActive] = useState(null)
  const [dirty, setDirty] = useState(() => new Set())
  const [sidebar, setSidebar] = useState('explorer')
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState(false)
  const [lines, setLines] = useState([])
  const [cmd, setCmd] = useState('')
  const [running, setRunning] = useState(false)
  const [palette, setPalette] = useState(false)
  const [pq, setPq] = useState('')
  const [pi, setPi] = useState(0)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [saved, setSaved] = useState(true)
  const [warn, setWarn] = useState([])
  const [lib, setLib] = useState(null)

  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const statesRef = useRef(new Map())
  const shownRef = useRef(null) // path the editor is showing right now
  const handlers = useRef({})
  const logRef = useRef(null)

  const motion = !prefs || prefs.motion

  // Load CodeMirror on first open of the window.
  useEffect(() => {
    let alive = true
    import('./editor.js').then((m) => {
      if (alive) setLib(m)
    })
    return () => {
      alive = false
    }
  }, [])

  // Destroy the view when the window closes.
  useEffect(
    () => () => {
      viewRef.current?.destroy()
      viewRef.current = null
    },
    [],
  )

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines])

  // ----- editor wiring -----

  handlers.current = {
    save: () => save(),
    run: () => runFile(shownRef.current),
    change: () => markChanged(),
  }

  function stateFor(path) {
    if (!statesRef.current.has(path)) {
      statesRef.current.set(
        path,
        lib.makeState(texts.current[path] ?? '', languageFor(path), {
          onSave: () => handlers.current.save(),
          onRun: () => handlers.current.run(),
          onChange: () => handlers.current.change(),
        }),
      )
    }
    return statesRef.current.get(path)
  }

  // Switch the single CodeMirror view to the active file, keeping each file's undo history.
  useEffect(() => {
    if (!lib || !active || !hostRef.current) return
    const view = viewRef.current
    const next = stateFor(active)
    if (!view) {
      viewRef.current = lib.makeView(hostRef.current, next)
    } else if (view.state !== next) {
      if (shownRef.current) statesRef.current.set(shownRef.current, view.state)
      view.setState(next)
    }
    shownRef.current = active
    setCursor(lib.cursorOf(viewRef.current.state))
    viewRef.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lib])

  function markChanged() {
    const path = shownRef.current
    if (!path || !viewRef.current) return
    texts.current[path] = viewRef.current.state.doc.toString()
    setCursor(lib.cursorOf(viewRef.current.state))
    setSaved(false)
    setDirty((d) => (d.has(path) ? d : new Set(d).add(path)))
  }

  function cursorChanged(view) {
    setCursor(lib.cursorOf(view.state))
  }

  // ----- files -----

  function openFile(path) {
    setOpen((o) => (o.includes(path) ? o : [...o, path]))
    setActive(path)
  }

  function closeTab(path) {
    const target = path ?? active
    if (!target) return
    const idx = open.indexOf(target)
    const nextOpen = open.filter((p) => p !== target)
    setOpen(nextOpen)
    if (target === active) {
      const neighbour = nextOpen[idx] ?? nextOpen[idx - 1] ?? null
      setActive(neighbour)
      if (!neighbour) {
        if (viewRef.current) statesRef.current.set(target, viewRef.current.state)
        shownRef.current = null
      }
    }
  }

  function save() {
    const path = shownRef.current
    if (!path || !viewRef.current) return
    texts.current[path] = viewRef.current.state.doc.toString()
    saveFiles(texts.current)
    setDirty((d) => {
      if (!d.has(path)) return d
      const n = new Set(d)
      n.delete(path)
      return n
    })
    setSaved(true)
    setWarn(detectSecrets(texts.current[path]))
  }

  function resetProject() {
    if (typeof window !== 'undefined' && !window.confirm('Reset the demo project? Your edits on this device will be replaced.')) return
    texts.current = resetFiles()
    statesRef.current.clear()
    viewRef.current?.destroy()
    viewRef.current = null
    shownRef.current = null
    setPaths(Object.keys(DEMO_FILES))
    setOpen([])
    setActive(null)
    setDirty(new Set())
    setWarn([])
    setSaved(true)
  }

  // ----- run and terminal -----

  function pushLines(next) {
    setLines((l) => [...l, ...next].slice(-MAX_LINES))
  }

  async function runFile(path) {
    if (!path) return pushLines([{ kind: 'err', text: 'run: open a .js file first' }])
    if (!isRunnable(path)) return pushLines([{ kind: 'err', text: `run: ${basename(path)} is not a .js file` }])
    setPanel(true)
    setRunning(true)
    pushLines([{ kind: 'cmd', text: `run ${path}` }])
    const result = await runInSandbox(texts.current[path] ?? '')
    pushLines([
      ...result.logs,
      ...(result.error ? [{ kind: 'err', text: result.error }] : []),
      { kind: 'dim', text: `${result.ms} ms · ${result.ok ? 'done' : 'failed'} · network allowed in sandbox` },
    ])
    setRunning(false)
  }

  function submitCommand(e) {
    e.preventDefault()
    const line = cmd
    setCmd('')
    pushLines([{ kind: 'cmd', text: `$ ${line}` }])
    const res = runCommand(line, texts.current)
    if (res.action?.type === 'clear') setLines([])
    else if (res.action?.type === 'run') runFile(res.action.path)
    else pushLines(res.lines)
  }

  // ----- palette and keys -----

  const palList = useMemo(() => filterPalette(pq), [pq])

  function execute(id) {
    setPalette(false)
    if (id === 'save') save()
    if (id === 'run') runFile(shownRef.current)
    if (id === 'terminal') setPanel((p) => !p)
    if (id === 'sidebar') setSidebar((s) => (s ? null : 'explorer'))
    if (id === 'close') closeTab()
    if (id === 'reset') resetProject()
  }

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      const inEditor = Boolean(e.target?.closest?.('.cm-editor'))
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPalette(true)
        setPq('')
        setPi(0)
      } else if (mod && e.key === '`') {
        e.preventDefault()
        setPanel((p) => !p)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebar((s) => (s ? null : 'explorer'))
      } else if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        closeTab()
      } else if (mod && !inEditor && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      } else if (mod && !inEditor && e.key === 'Enter') {
        e.preventDefault()
        runFile(shownRef.current)
      } else if (e.key === 'Escape' && palette) {
        setPalette(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ----- render -----

  const rows = useMemo(() => {
    const all = treeRows(paths)
    const q = query.trim().toLowerCase()
    return q ? all.filter((r) => r.kind === 'file' && r.path.toLowerCase().includes(q)) : all
  }, [paths, query])

  const language = active ? languageFor(active).toUpperCase() : null

  return (
    <div className={`os-code ${motion ? '' : 'is-static'}`}>
      <div className="os-code-body">
        <nav className="os-code-activity" aria-label="Activity bar">
          <button className={sidebar === 'explorer' ? 'is-on' : ''} onClick={() => setSidebar(sidebar === 'explorer' ? null : 'explorer')} aria-label="Explorer" title="Explorer">
            <FilesIcon width={20} height={20} />
          </button>
          <button className={sidebar === 'search' ? 'is-on' : ''} onClick={() => setSidebar(sidebar === 'search' ? null : 'search')} aria-label="Search files" title="Search files">
            <InspectorIcon width={20} height={20} />
          </button>
          <button onClick={() => runFile(shownRef.current)} aria-label="Run active file" title="Run (Ctrl+Enter)" disabled={running}>
            <PlayIcon width={20} height={20} />
          </button>
          <span className="os-code-grow" />
          <button className={panel ? 'is-on' : ''} onClick={() => setPanel((p) => !p)} aria-label="Toggle terminal" title="Terminal (Ctrl+`)">
            <TerminalIcon width={20} height={20} />
          </button>
          <button onClick={() => setPalette(true)} aria-label="Command palette" title="Command palette (Ctrl+Shift+P)">
            <SettingsIcon width={20} height={20} />
          </button>
        </nav>

        {sidebar && (
          <aside className="os-code-side" aria-label={sidebar === 'search' ? 'Search' : 'Explorer'}>
            <div className="os-code-side-head">{sidebar === 'search' ? 'Search' : 'Explorer'}</div>
            {sidebar === 'search' && (
              <input
                className="os-input os-code-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="file name…"
                aria-label="Filter files"
                spellCheck={false}
              />
            )}
            <div className="os-code-tree" role="tree">
              <div className="os-code-proj">VOID-LAB</div>
              {rows.map((r) =>
                r.kind === 'dir' ? (
                  <div key={r.path} className="os-code-dir" style={{ paddingLeft: 12 + r.depth * 12 }}>▾ {r.name}</div>
                ) : (
                  <button
                    key={r.path}
                    role="treeitem"
                    aria-selected={active === r.path}
                    className={`os-code-file ${active === r.path ? 'is-active' : ''}`}
                    style={{ paddingLeft: 12 + r.depth * 12 }}
                    onClick={() => openFile(r.path)}
                  >
                    {r.name}
                    {dirty.has(r.path) && <i className="os-code-dot" aria-label="unsaved" />}
                  </button>
                ),
              )}
              {!rows.length && <div className="os-muted os-small" style={{ padding: 12 }}>no matches</div>}
            </div>
          </aside>
        )}

        <div className="os-code-main">
          <div className="os-code-tabs" role="tablist">
            {open.map((p) => (
              <div key={p} role="tab" aria-selected={active === p} className={`os-code-tab ${active === p ? 'is-active' : ''}`} onClick={() => setActive(p)} onAuxClick={(e) => e.button === 1 && closeTab(p)}>
                <span>{basename(p)}</span>
                {dirty.has(p) && <i className="os-code-dot" aria-label="unsaved" />}
                <button className="os-code-x" aria-label={`Close ${basename(p)}`} onClick={(e) => { e.stopPropagation(); closeTab(p) }}>
                  <CloseIcon width={10} height={10} />
                </button>
              </div>
            ))}
          </div>

          {warn.length > 0 && (
            <div className="os-code-warn" role="alert">
              <span>
                <b>Looks like a secret.</b> {warn.join(' ')} Remove it before you share this project.
              </span>
              <button className="os-btn" onClick={() => setWarn([])}>Dismiss</button>
            </div>
          )}

          <div className="os-code-editor">
            {!active && (
              <div className="os-code-empty">
                <p className="os-title-sm">VOID.CODE</p>
                <p className="os-muted os-small">Open a file from the explorer. Ctrl+Shift+P opens the command palette.</p>
              </div>
            )}
            <div ref={hostRef} className="os-code-host" hidden={!active} onKeyUp={() => viewRef.current && cursorChanged(viewRef.current)} onClick={() => viewRef.current && cursorChanged(viewRef.current)} />
          </div>

          {panel && (
            <section className="os-code-panel" aria-label="Terminal">
              <div className="os-code-panel-head">
                <span className="os-label">Output</span>
                {running && <span className="os-tag os-tag-warn">running…</span>}
                <button className="os-btn" onClick={() => setLines([])}>Clear</button>
              </div>
              <div className="os-code-log" ref={logRef} role="log" aria-live="polite">
                {lines.map((l, i) => (
                  <div key={i} className={`os-code-line os-code-l-${l.kind}`}>{l.text || ' '}</div>
                ))}
                {!lines.length && <div className="os-muted os-small">type help, or run a .js file</div>}
              </div>
              <form className="os-code-cmd" onSubmit={submitCommand}>
                <span className="os-term-prompt">$</span>
                <input value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Command" spellCheck={false} autoComplete="off" />
              </form>
            </section>
          )}

          {palette && (
            <div className="os-code-palette-wrap" onMouseDown={() => setPalette(false)}>
              <div className="os-code-palette" onMouseDown={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={pq}
                  placeholder="type a command"
                  aria-label="Command palette"
                  onChange={(e) => {
                    setPq(e.target.value)
                    setPi(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') setPi((i) => Math.min(palList.length - 1, i + 1))
                    if (e.key === 'ArrowUp') setPi((i) => Math.max(0, i - 1))
                    if (e.key === 'Enter' && palList[pi]) execute(palList[pi].id)
                    if (e.key === 'Escape') setPalette(false)
                  }}
                />
                <ul role="listbox">
                  {palList.map((c, i) => (
                    <li key={c.id} role="option" aria-selected={i === pi} className={i === pi ? 'is-on' : ''} onMouseEnter={() => setPi(i)} onClick={() => execute(c.id)}>
                      <span>{c.label}</span>
                      {c.keys && <kbd>{c.keys}</kbd>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="os-code-status">
        <span>⎇ main <span className="os-muted">(demo)</span></span>
        <span className="os-code-grow" />
        {active && (
          <>
            <span>Ln {cursor.line}, Col {cursor.col}</span>
            <span>{lineCount(texts.current[active] ?? '')} lines</span>
            <span>{language}</span>
          </>
        )}
        <span className={saved ? 'os-ok' : 'os-warnc'}>{saved ? 'saved' : 'unsaved'}</span>
        <span>sandbox: worker · 2s</span>
      </footer>
    </div>
  )
}
