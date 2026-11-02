import { useEffect, useMemo, useRef, useState } from 'react'
import {
  loadProject,
  saveProject,
  resetProject,
  languageFor,
  isRunnable,
  treeRows,
  lineCount,
  baseName,
  parentDir,
  joinPath,
  nameError,
  addFile,
  addFolder,
  renamePath,
  removePath,
  crumbs,
} from './files.js'
import { detectSecrets } from './secrets.js'
import { filterPalette, runCommand } from './commands.js'
import { runInSandbox } from './runner.js'
import { FilesIcon, InspectorIcon, PlayIcon, SettingsIcon, TerminalIcon, CloseIcon } from '../icons.jsx'

const MAX_LINES = 300

// VOID.CODE: a folder-aware explorer, editor tabs, quick open, a command palette and a terminal panel.
// Text is kept in a ref while typing, so keystrokes do not re-render the window.
export function CodeApp({ prefs }) {
  const project = useRef(null)
  if (project.current === null) project.current = loadProject()
  const [, bump] = useState(0)
  const changed = () => bump((v) => v + 1)

  const [expanded, setExpanded] = useState(() => new Set(['src']))
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
  const [quick, setQuick] = useState(false)
  const [qq, setQq] = useState('')
  const [menu, setMenu] = useState(null) // { x, y, path, kind }
  const [inline, setInline] = useState(null) // { mode: 'file'|'folder'|'rename', dir, path?, value, error }
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [saved, setSaved] = useState(true)
  const [warn, setWarn] = useState([])
  const [lib, setLib] = useState(null)

  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const statesRef = useRef(new Map())
  const shownRef = useRef(null)
  const handlers = useRef({})
  const logRef = useRef(null)
  const treeRef = useRef(null)

  useEffect(() => {
    let alive = true
    import('./editor.js').then((m) => {
      if (alive) setLib(m)
    })
    return () => {
      alive = false
    }
  }, [])

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
        lib.makeState(project.current.files[path] ?? '', languageFor(path), {
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
    project.current.files[path] = viewRef.current.state.doc.toString()
    setCursor(lib.cursorOf(viewRef.current.state))
    setSaved(false)
    setDirty((d) => (d.has(path) ? d : new Set(d).add(path)))
  }

  // ----- files and folders -----

  function openFile(path) {
    setOpen((o) => (o.includes(path) ? o : [...o, path]))
    setActive(path)
    setMenu(null)
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

  function persist() {
    saveProject(project.current)
  }

  function save() {
    const path = shownRef.current
    if (!path || !viewRef.current) return
    project.current.files[path] = viewRef.current.state.doc.toString()
    persist()
    setDirty((d) => {
      if (!d.has(path)) return d
      const n = new Set(d)
      n.delete(path)
      return n
    })
    setSaved(true)
    setWarn(detectSecrets(project.current.files[path]))
  }

  function revealDir(dir) {
    if (!dir) return
    setExpanded((s) => {
      const n = new Set(s)
      const parts = dir.split('/')
      for (let i = 1; i <= parts.length; i++) n.add(parts.slice(0, i).join('/'))
      return n
    })
  }

  // Create a file or folder inside `dir`, from the inline row or a terminal command.
  function createItem(kind, path) {
    const next = kind === 'file' ? addFile(project.current, path) : addFolder(project.current, path)
    project.current = next
    if (kind === 'folder') revealDir(path)
    else {
      revealDir(parentDir(path))
      persist()
      changed()
      openFile(path)
      return
    }
    persist()
    changed()
  }

  // Rename a file or a folder. Open tabs, undo history and the active file follow the new path.
  function renameItem(path, newPath) {
    if (newPath === path) return
    project.current = renamePath(project.current, path, newPath)
    const move = (p) => (p === path || p.startsWith(`${path}/`) ? newPath + p.slice(path.length) : p)
    for (const [key, state] of [...statesRef.current.entries()]) {
      if (key === path || key.startsWith(`${path}/`)) {
        statesRef.current.delete(key)
        statesRef.current.set(move(key), state)
      }
    }
    if (shownRef.current && (shownRef.current === path || shownRef.current.startsWith(`${path}/`))) shownRef.current = move(shownRef.current)
    setOpen((o) => o.map(move))
    setActive((a) => (a ? move(a) : a))
    setDirty((d) => new Set([...d].map(move)))
    setExpanded((s) => new Set([...s].map(move)))
    persist()
    changed()
  }

  function removeItem(path, kind) {
    if (kind === 'dir' && typeof window !== 'undefined' && !window.confirm(`Delete the folder "${path}" and everything in it?`)) return
    project.current = removePath(project.current, path)
    const inside = (p) => p === path || p.startsWith(`${path}/`)
    for (const key of [...statesRef.current.keys()]) if (inside(key)) statesRef.current.delete(key)
    const remaining = open.filter((p) => !inside(p))
    setOpen(remaining)
    if (active && inside(active)) {
      const next = remaining[0] ?? null
      setActive(next)
      if (!next) shownRef.current = null
    }
    setDirty((d) => new Set([...d].filter((p) => !inside(p))))
    setMenu(null)
    persist()
    changed()
  }

  function commitInline() {
    if (!inline) return
    const err = nameError(inline.value)
    if (err) return setInline({ ...inline, error: err })
    const name = inline.value.trim()
    if (inline.mode === 'rename') {
      const target = joinPath(parentDir(inline.path), name)
      if (target !== inline.path && (project.current.files[target] !== undefined || project.current.folders.includes(target))) {
        return setInline({ ...inline, error: 'Something with that name already exists here.' })
      }
      renameItem(inline.path, target)
    } else {
      const path = joinPath(inline.dir, name)
      const exists = project.current.files[path] !== undefined || project.current.folders.includes(path)
      if (exists) return setInline({ ...inline, error: 'Something with that name already exists here.' })
      createItem(inline.mode === 'file' ? 'file' : 'folder', path)
    }
    setInline(null)
  }

  function startInline(mode, dir = '', path) {
    setMenu(null)
    if (mode !== 'rename') revealDir(dir)
    setInline({ mode, dir, path, value: mode === 'rename' ? baseName(path) : '', error: '' })
    setTimeout(() => treeRef.current?.querySelector('.os-code-inline input')?.focus(), 0)
  }

  // ----- run and terminal -----

  function pushLines(next) {
    setLines((l) => [...l, ...next].slice(-MAX_LINES))
  }

  async function runFile(path) {
    if (!path) return pushLines([{ kind: 'err', text: 'run: open a .js file first' }])
    if (!isRunnable(path)) return pushLines([{ kind: 'err', text: `run: ${baseName(path)} is not a .js file` }])
    setPanel(true)
    setRunning(true)
    pushLines([{ kind: 'cmd', text: `run ${path}` }])
    const result = await runInSandbox(project.current.files[path] ?? '')
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
    const res = runCommand(line, project.current.files)
    const a = res.action
    if (a?.type === 'clear') setLines([])
    else if (a?.type === 'run') runFile(a.path)
    else if (a?.type === 'mkdir') {
      createItem('folder', a.path)
      pushLines([{ kind: 'dim', text: `created folder ${a.path}` }])
    } else if (a?.type === 'touch') {
      if (project.current.files[a.path] !== undefined) pushLines([{ kind: 'err', text: `touch: ${a.path} already exists` }])
      else {
        createItem('file', a.path)
        pushLines([{ kind: 'dim', text: `created ${a.path}` }])
      }
    } else if (a?.type === 'rm') {
      const known = project.current.files[a.path] !== undefined || project.current.folders.includes(a.path)
      if (!known) pushLines([{ kind: 'err', text: `rm: ${a.path}: no such file or folder` }])
      else {
        removeItem(a.path, project.current.files[a.path] !== undefined ? 'file' : 'dir')
        pushLines([{ kind: 'dim', text: `removed ${a.path}` }])
      }
    } else pushLines(res.lines)
  }

  // ----- palette, quick open and keys -----

  const palList = useMemo(() => filterPalette(pq), [pq])
  const quickQ = qq.trim().toLowerCase()
  const quickList = Object.keys(project.current.files)
    .filter((p) => !quickQ || p.toLowerCase().includes(quickQ))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12)

  function execute(id) {
    setPalette(false)
    if (id === 'save') save()
    if (id === 'run') runFile(shownRef.current)
    if (id === 'terminal') setPanel((p) => !p)
    if (id === 'sidebar') setSidebar((s) => (s ? null : 'explorer'))
    if (id === 'close') closeTab()
    if (id === 'reset') resetAll()
    if (id === 'newfile') startInline('file', '')
    if (id === 'newfolder') startInline('folder', '')
  }

  function resetAll() {
    if (typeof window !== 'undefined' && !window.confirm('Reset the demo project? Your files and folders on this device will be replaced.')) return
    project.current = resetProject()
    statesRef.current.clear()
    viewRef.current?.destroy()
    viewRef.current = null
    shownRef.current = null
    setOpen([])
    setActive(null)
    setDirty(new Set())
    setWarn([])
    setSaved(true)
    setExpanded(new Set(['src']))
    changed()
  }

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      const inEditor = Boolean(e.target?.closest?.('.cm-editor'))
      const inField = Boolean(e.target?.matches?.('input, textarea, select'))
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPalette(true)
        setPq('')
        setPi(0)
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'p' && !inEditor) {
        e.preventDefault()
        setQuick(true)
        setQq('')
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
      } else if (mod && !inField && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        startInline('file', '')
      } else if (e.key === 'F2' && active && !inField) {
        e.preventDefault()
        startInline('rename', '', active)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && active && !inField && !inEditor && treeRef.current?.contains(document.activeElement)) {
        removeItem(active, 'file')
      } else if (e.key === 'Escape') {
        if (palette) setPalette(false)
        else if (quick) setQuick(false)
        else if (menu) setMenu(null)
        else if (inline) setInline(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!menu) return undefined
    const off = () => setMenu(null)
    window.addEventListener('pointerdown', off, { once: true })
    return () => window.removeEventListener('pointerdown', off)
  }, [menu])

  // ----- render -----

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = treeRows(project.current, expanded)
    return q ? all.filter((r) => r.kind === 'file' && r.path.toLowerCase().includes(q)) : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, query, project.current, lines.length, open.length, dirty.size])

  const language = active ? languageFor(active).toUpperCase() : null
  const motion = !prefs || prefs.motion

  const inlineRow = (depth) => (
    <div className="os-code-inline" style={{ paddingLeft: 12 + depth * 12 }}>
      <input
        value={inline.value}
        onChange={(e) => setInline({ ...inline, value: e.target.value, error: '' })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitInline()
          if (e.key === 'Escape') setInline(null)
        }}
        onBlur={() => setInline(null)}
        placeholder={inline.mode === 'folder' ? 'folder name' : 'file name'}
        aria-label={inline.mode === 'folder' ? 'New folder name' : inline.mode === 'rename' ? 'New name' : 'New file name'}
        spellCheck={false}
      />
      {inline.error && <span className="os-code-inline-err" role="alert">{inline.error}</span>}
    </div>
  )

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
            <div className="os-code-side-head">
              <span>{sidebar === 'search' ? 'Search' : 'Explorer'}</span>
              {sidebar === 'explorer' && (
                <span className="os-code-actions">
                  <button onClick={() => startInline('file', '')} aria-label="New file" title="New file (Ctrl+N)">+</button>
                  <button onClick={() => startInline('folder', '')} aria-label="New folder" title="New folder">▭</button>
                  <button onClick={() => setExpanded(new Set())} aria-label="Collapse folders" title="Collapse all">⊟</button>
                </span>
              )}
            </div>
            {sidebar === 'search' && (
              <input className="os-input os-code-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="file name…" aria-label="Filter files" spellCheck={false} />
            )}
            <div className="os-code-tree" role="tree" ref={treeRef} tabIndex={0} aria-label="Project files">
              <div className="os-code-proj">VOID-LAB</div>
              {inline && inline.mode !== 'rename' && inline.dir === '' && inlineRow(0)}
              {rows.map((r) => {
                if (r.kind === 'dir') {
                  return (
                    <div key={`d:${r.path}`}>
                      <button
                        role="treeitem"
                        aria-expanded={r.open}
                        className="os-code-dir"
                        style={{ paddingLeft: 12 + r.depth * 12 }}
                        onClick={() =>
                          setExpanded((s) => {
                            const n = new Set(s)
                            if (n.has(r.path)) n.delete(r.path)
                            else n.add(r.path)
                            return n
                          })
                        }
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMenu({ x: e.clientX, y: e.clientY, path: r.path, kind: 'dir' })
                        }}
                      >
                        <span className="os-code-caret">{r.open ? '▾' : '▸'}</span> {r.name}
                      </button>
                      {inline && inline.mode !== 'rename' && inline.dir === r.path && r.open && inlineRow(r.depth + 1)}
                    </div>
                  )
                }
                if (inline?.mode === 'rename' && inline.path === r.path) {
                  return <div key={`f:${r.path}`}>{inlineRow(r.depth)}</div>
                }
                return (
                  <button
                    key={`f:${r.path}`}
                    role="treeitem"
                    aria-selected={active === r.path}
                    className={`os-code-file ${active === r.path ? 'is-active' : ''}`}
                    style={{ paddingLeft: 12 + r.depth * 12 + 14 }}
                    onClick={() => openFile(r.path)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMenu({ x: e.clientX, y: e.clientY, path: r.path, kind: 'file' })
                    }}
                  >
                    {r.name}
                    {dirty.has(r.path) && <i className="os-code-dot" aria-label="unsaved" />}
                  </button>
                )
              })}
              {!rows.length && <div className="os-muted os-small" style={{ padding: 12 }}>no matches</div>}
            </div>
          </aside>
        )}

        <div className="os-code-main">
          <div className="os-code-tabs" role="tablist">
            {open.map((p) => (
              <div
                key={p}
                role="tab"
                aria-selected={active === p}
                className={`os-code-tab ${active === p ? 'is-active' : ''}`}
                onClick={() => setActive(p)}
                onAuxClick={(e) => e.button === 1 && closeTab(p)}
              >
                <span>{baseName(p)}</span>
                {dirty.has(p) && <i className="os-code-dot" aria-label="unsaved" />}
                <button className="os-code-x" aria-label={`Close ${baseName(p)}`} onClick={(e) => { e.stopPropagation(); closeTab(p) }}>
                  <CloseIcon width={10} height={10} />
                </button>
              </div>
            ))}
          </div>

          {active && (
            <div className="os-code-crumbs" aria-label="Path">
              {crumbs(active).map((c, i, all) => (
                <span key={i}>
                  {c}
                  {i < all.length - 1 && <span className="os-code-sep"> › </span>}
                </span>
              ))}
            </div>
          )}

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
                <p className="os-muted os-small">Open a file from the explorer, or create one with + (Ctrl+N).</p>
                <p className="os-muted os-small">Ctrl+P quick open · Ctrl+Shift+P command palette · F2 rename · right-click for more</p>
              </div>
            )}
            <div ref={hostRef} className="os-code-host" hidden={!active} onKeyUp={() => viewRef.current && setCursor(lib.cursorOf(viewRef.current.state))} onClick={() => viewRef.current && setCursor(lib.cursorOf(viewRef.current.state))} />
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

          {quick && (
            <div className="os-code-palette-wrap" onMouseDown={() => setQuick(false)}>
              <div className="os-code-palette" onMouseDown={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={qq}
                  placeholder="Go to file…"
                  aria-label="Quick open"
                  onChange={(e) => setQq(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickList[0]) {
                      openFile(quickList[0])
                      setQuick(false)
                    }
                    if (e.key === 'Escape') setQuick(false)
                  }}
                />
                <ul role="listbox">
                  {quickList.map((p) => (
                    <li key={p} role="option" onClick={() => { openFile(p); setQuick(false) }}>
                      <span>{baseName(p)}</span>
                      <kbd>{parentDir(p) || '/'}</kbd>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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

          {menu && (
            <div className="os-code-ctx" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
              {menu.kind === 'dir' && <button role="menuitem" onClick={() => startInline('file', menu.path)}>New file here</button>}
              {menu.kind === 'dir' && <button role="menuitem" onClick={() => startInline('folder', menu.path)}>New folder here</button>}
              <button role="menuitem" onClick={() => startInline('rename', '', menu.path)}>Rename</button>
              <button role="menuitem" className="is-danger" onClick={() => removeItem(menu.path, menu.kind)}>Delete</button>
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
            <span>{lineCount(project.current.files[active] ?? '')} lines</span>
            <span>{language}</span>
          </>
        )}
        <span className={saved ? 'os-ok' : 'os-warnc'}>{saved ? 'saved' : 'unsaved'}</span>
        <span>sandbox: worker · 2s</span>
      </footer>
    </div>
  )
}
