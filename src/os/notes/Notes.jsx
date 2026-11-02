import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createVault,
  unlockVault,
  saveVault,
  passphraseProblem,
  readStored,
  writeStored,
  eraseStored,
  MIN_PASSPHRASE,
} from './vault.js'
import { render, wikiLinks, tagsOf, backlinksTo, titleOf, wordCount } from './markdown.js'

// VOID notes: an Obsidian-style notebook in an encrypted vault. Notes are plain Markdown.
// The vault is decrypted only while unlocked, and it locks itself after 5 minutes without input.

const AUTO_LOCK_MS = 5 * 60 * 1000
const SAVE_DELAY_MS = 400

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// The toolbar: each button inserts Markdown around the selection.
const TOOLS = [
  { id: 'h', label: 'H', title: 'Heading', before: '## ', after: '' },
  { id: 'b', label: 'B', title: 'Bold', before: '**', after: '**', ph: 'bold' },
  { id: 'i', label: 'I', title: 'Italic', before: '*', after: '*', ph: 'italic' },
  { id: 's', label: 'S', title: 'Strikethrough', before: '~~', after: '~~', ph: 'text' },
  { id: 'c', label: '</>', title: 'Code', before: '`', after: '`', ph: 'code' },
  { id: 'ul', label: '•', title: 'List', before: '- ', after: '' },
  { id: 'task', label: '☐', title: 'Task', before: '- [ ] ', after: '' },
  { id: 'q', label: '❝', title: 'Quote', before: '> ', after: '' },
  { id: 'link', label: '↗', title: 'Link', before: '[', after: '](https://)', ph: 'text' },
  { id: 'wiki', label: '[[ ]]', title: 'Link to another note', before: '[[', after: ']]', ph: 'Note name' },
  { id: 'rule', label: '—', title: 'Divider', before: '\n---\n', after: '' },
]

function Lock({ children }) {
  return <div className="os-nt-lock">{children}</div>
}

export function Notes() {
  const [stored, setStored] = useState(() => readStored())
  const [status, setStatus] = useState(() => (readStored() ? 'locked' : 'setup'))
  const [data, setData] = useState(null) // { notes, created } while unlocked
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('split')
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState(null)
  const [folderFilter, setFolderFilter] = useState(null)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [ack, setAck] = useState(false)

  const key = useRef(null)
  const storedRef = useRef(stored)
  storedRef.current = stored
  const dataRef = useRef(null)
  const saveTimer = useRef(0)
  const lockTimer = useRef(0)
  const textarea = useRef(null)

  const notes = useMemo(() => data?.notes ?? [], [data])
  const current = notes.find((n) => n.id === selected) ?? null

  // ----- persistence -----

  async function persistNow(next) {
    if (!key.current || !storedRef.current) return
    const box = await saveVault(key.current, storedRef.current, next)
    writeStored(box)
    storedRef.current = box
    setStored(box)
    setSaved(true)
  }

  function commit(next) {
    dataRef.current = next
    setData(next)
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistNow(next), SAVE_DELAY_MS)
  }

  // ----- lock and unlock -----

  function lock() {
    clearTimeout(saveTimer.current)
    clearTimeout(lockTimer.current)
    if (key.current && dataRef.current) persistNow(dataRef.current)
    key.current = null
    dataRef.current = null
    setData(null)
    setSelected(null)
    setPass('')
    setPass2('')
    setStatus('locked')
  }

  function armAutoLock() {
    clearTimeout(lockTimer.current)
    if (status !== 'unlocked') return
    lockTimer.current = setTimeout(lock, AUTO_LOCK_MS)
  }

  useEffect(() => {
    if (status !== 'unlocked') return undefined
    const poke = () => armAutoLock()
    window.addEventListener('pointerdown', poke)
    window.addEventListener('keydown', poke)
    armAutoLock()
    return () => {
      window.removeEventListener('pointerdown', poke)
      window.removeEventListener('keydown', poke)
      clearTimeout(lockTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => () => {
    clearTimeout(saveTimer.current)
    clearTimeout(lockTimer.current)
  }, [])

  async function unlock(e) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { key: k, data: d } = await unlockVault(pass, storedRef.current)
      key.current = k
      dataRef.current = d
      setData(d)
      setSelected(d.notes[0]?.id ?? null)
      setPass('')
      setStatus('unlocked')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function create(e) {
    e?.preventDefault()
    const problem = passphraseProblem(pass)
    if (problem) return setError(problem)
    if (pass !== pass2) return setError('The two passphrases do not match.')
    if (!ack) return setError('Confirm that you understand there is no recovery.')
    setError('')
    setBusy(true)
    try {
      const { stored: box, key: k, data: d } = await createVault(pass)
      writeStored(box)
      storedRef.current = box
      setStored(box)
      key.current = k
      const starter = {
        ...d,
        notes: [{ id: newId(), body: '# Welcome to VOID notes\n\nThis note is encrypted on this device.\n\n- Link to other notes with [[double brackets]]\n- Tag with #ideas or #wallet\n- [ ] Try a task list\n\n> Your passphrase never leaves this window.', folder: '', created: Date.now(), updated: Date.now() }],
      }
      dataRef.current = starter
      setData(starter)
      setSelected(starter.notes[0].id)
      await persistNow(starter)
      setPass('')
      setPass2('')
      setStatus('unlocked')
    } catch (err) {
      setError(err.message || 'Could not create the vault.')
    } finally {
      setBusy(false)
    }
  }

  function forget() {
    if (!window.confirm('Delete the encrypted vault on this device? Every note in it is lost for good.')) return
    eraseStored()
    setStored(null)
    storedRef.current = null
    setStatus('setup')
  }

  // ----- notes -----

  function updateCurrent(patch) {
    const d = dataRef.current
    if (!d || !current) return
    const next = {
      ...d,
      notes: d.notes.map((n) => (n.id === current.id ? { ...n, ...patch, updated: Date.now() } : n)),
    }
    commit(next)
  }

  function newNote(folder = '') {
    const d = dataRef.current
    if (!d) return
    const note = { id: newId(), body: '# Untitled\n\n', folder, created: Date.now(), updated: Date.now() }
    commit({ ...d, notes: [note, ...d.notes] })
    setSelected(note.id)
    setMode('edit')
    setTimeout(() => textarea.current?.focus(), 0)
  }

  // Open a note by its title (from a [[link]]), creating it if it does not exist yet.
  function openByTitle(title) {
    const d = dataRef.current
    const key2 = title.trim().toLowerCase()
    const found = d.notes.find((n) => titleOf(n.body).toLowerCase() === key2)
    if (found) return setSelected(found.id)
    const note = { id: newId(), body: `# ${title.trim()}\n\n`, folder: '', created: Date.now(), updated: Date.now() }
    commit({ ...d, notes: [note, ...d.notes] })
    setSelected(note.id)
  }

  function deleteCurrent() {
    const d = dataRef.current
    if (!current || !window.confirm(`Delete "${titleOf(current.body)}"?`)) return
    const rest = d.notes.filter((n) => n.id !== current.id)
    commit({ ...d, notes: rest })
    setSelected(rest[0]?.id ?? null)
  }

  // Insert Markdown around the selection in the editor, then put the cursor back.
  function insert(tool) {
    const el = textarea.current
    if (!el || !current) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const picked = value.slice(s, e) || tool.ph || ''
    const text = `${value.slice(0, s)}${tool.before}${picked}${tool.after}${value.slice(e)}`
    updateCurrent({ body: text })
    const caret = s + tool.before.length + picked.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  // ----- derived lists -----

  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort(), [notes])
  const tags = useMemo(() => {
    const count = new Map()
    for (const n of notes) for (const t of tagsOf(n.body)) count.set(t, (count.get(t) || 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [notes])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => (folderFilter === null ? true : (n.folder || '') === folderFilter))
      .filter((n) => (tagFilter ? tagsOf(n.body).includes(tagFilter) : true))
      .filter((n) => !q || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updated - a.updated)
  }, [notes, query, tagFilter, folderFilter])

  const html = useMemo(() => (current ? render(current.body) : ''), [current?.body]) // eslint-disable-line react-hooks/exhaustive-deps
  const links = current ? wikiLinks(current.body) : []
  const linkedFrom = current ? backlinksTo(notes, titleOf(current.body)) : []

  function onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey
    if (status !== 'unlocked') return
    if (mod && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      newNote(folderFilter || '')
    } else if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      setMode((m) => (m === 'edit' ? 'split' : m === 'split' ? 'read' : 'edit'))
    } else if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      lock()
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault()
      clearTimeout(saveTimer.current)
      persistNow(dataRef.current)
    }
  }

  // ----- screens -----

  if (status === 'setup') {
    return (
      <div className="os-nt" onKeyDown={onKeyDown}>
        <Lock>
          <div className="os-nt-lock-card">
            <span className="os-nt-lock-mark" aria-hidden="true">◈</span>
            <h2>Create your notes vault</h2>
            <p className="os-muted os-small">
              Notes are encrypted with AES-256-GCM. The key comes from your passphrase, which stays in this window.
            </p>
            <form className="os-stack" onSubmit={create}>
              <input className="os-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={`Passphrase (at least ${MIN_PASSPHRASE} characters)`} aria-label="Passphrase" autoComplete="new-password" />
              <input className="os-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repeat passphrase" aria-label="Repeat passphrase" autoComplete="new-password" />
              <label className="os-nt-ack">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I understand there is <b>no recovery</b>. Lose the passphrase and these notes cannot be opened.</span>
              </label>
              {error && <p className="os-error" role="alert">{error}</p>}
              <button className="os-btn os-btn-primary os-wide" type="submit" disabled={busy}>{busy ? 'Encrypting…' : 'Create vault'}</button>
            </form>
          </div>
        </Lock>
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="os-nt" onKeyDown={onKeyDown}>
        <Lock>
          <div className="os-nt-lock-card">
            <span className="os-nt-lock-mark is-locked" aria-hidden="true">◈</span>
            <h2>Vault locked</h2>
            <p className="os-muted os-small">Enter your passphrase to read your notes. They lock again after five minutes without input.</p>
            <form className="os-stack" onSubmit={unlock}>
              <input className="os-input" type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase" aria-label="Passphrase" autoComplete="current-password" />
              {error && <p className="os-error" role="alert">{error}</p>}
              <button className="os-btn os-btn-primary os-wide" type="submit" disabled={busy || !pass}>{busy ? 'Decrypting…' : 'Unlock'}</button>
            </form>
            <button className="os-btn-link" onClick={forget}>Forget this vault on this device</button>
          </div>
        </Lock>
      </div>
    )
  }

  return (
    <div className={`os-nt os-nt-${mode}`} onKeyDown={onKeyDown}>
      <aside className="os-nt-side" aria-label="Notes">
        <div className="os-nt-side-top">
          <input className="os-input os-nt-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" spellCheck={false} />
          <button className="os-nt-new" onClick={() => newNote(folderFilter || '')} aria-label="New note" title="New note (Ctrl+N)">+</button>
        </div>

        <div className="os-nt-section">
          <span className="os-label">Folders</span>
          <button className={`os-nt-item ${folderFilter === null ? 'is-on' : ''}`} onClick={() => setFolderFilter(null)}>All notes <em>{notes.length}</em></button>
          <button className={`os-nt-item ${folderFilter === '' ? 'is-on' : ''}`} onClick={() => setFolderFilter('')}>Unfiled <em>{notes.filter((n) => !n.folder).length}</em></button>
          {folders.map((f) => (
            <button key={f} className={`os-nt-item ${folderFilter === f ? 'is-on' : ''}`} onClick={() => setFolderFilter(f)}>{f} <em>{notes.filter((n) => n.folder === f).length}</em></button>
          ))}
        </div>

        <div className="os-nt-section">
          <span className="os-label">Tags</span>
          <div className="os-nt-tags">
            {tags.map(([t, c]) => (
              <button key={t} className={`os-nt-tagchip ${tagFilter === t ? 'is-on' : ''}`} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t} <em>{c}</em></button>
            ))}
            {!tags.length && <span className="os-muted os-small">Add #tags to your notes.</span>}
          </div>
        </div>

        <div className="os-nt-section os-nt-list">
          <span className="os-label">{visible.length} notes</span>
          {visible.map((n) => (
            <button key={n.id} className={`os-nt-note ${selected === n.id ? 'is-on' : ''}`} onClick={() => { setSelected(n.id); setMode((m) => (m === 'edit' ? 'split' : m)) }}>
              <b>{titleOf(n.body)}</b>
              <span className="os-muted os-small">{new Date(n.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {n.folder || 'Unfiled'}</span>
            </button>
          ))}
        </div>

        <div className="os-nt-side-foot">
          <span className="os-muted os-small">🔒 Encrypted on this device</span>
          <button className="os-btn" onClick={lock}>Lock</button>
        </div>
      </aside>

      <section className="os-nt-main">
        {current ? (
          <>
            <header className="os-nt-head">
              <h2 className="os-nt-title">{titleOf(current.body)}</h2>
              <div className="os-row">
                <div className="os-nt-modes" role="group" aria-label="View">
                  {[['edit', 'Edit'], ['split', 'Split'], ['read', 'Read']].map(([id, label]) => (
                    <button key={id} className={mode === id ? 'is-on' : ''} onClick={() => setMode(id)} aria-pressed={mode === id}>{label}</button>
                  ))}
                </div>
                <select className="os-input os-nt-folder" value={current.folder || ''} onChange={(e) => updateCurrent({ folder: e.target.value })} aria-label="Folder">
                  <option value="">Unfiled</option>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button className="os-btn" onClick={deleteCurrent}>Delete</button>
              </div>
            </header>

            {mode !== 'read' && (
              <div className="os-nt-toolbar" role="toolbar" aria-label="Formatting">
                {TOOLS.map((t) => (
                  <button key={t.id} title={t.title} aria-label={t.title} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t)}>{t.label}</button>
                ))}
              </div>
            )}

            <div className="os-nt-panes">
              {mode !== 'read' && (
                <textarea
                  ref={textarea}
                  className="os-nt-editor"
                  value={current.body}
                  onChange={(e) => updateCurrent({ body: e.target.value })}
                  spellCheck={false}
                  aria-label="Note text"
                  placeholder="Start writing. Markdown works: # headings, **bold**, - lists, [[links]]"
                />
              )}
              {mode !== 'edit' && (
                <article
                  className="os-nt-preview"
                  aria-label="Rendered note"
                  // A wiki link opens on press. The window re-renders on mouse down, which replaces the link
                  // element, so a click (press + release on the same node) would never fire.
                  onMouseDown={(e) => {
                    const t = e.target.closest('[data-note]')
                    if (t && e.button === 0) {
                      e.preventDefault()
                      openByTitle(t.dataset.note)
                    }
                  }}
                  onClick={(e) => {
                    const t = e.target.closest('[data-note]')
                    if (t) e.preventDefault()
                  }}
                  dangerouslySetInnerHTML={{ __html: html || '<p class="os-muted">Nothing here yet.</p>' }}
                />
              )}
            </div>

            <footer className="os-nt-foot">
              <span className="os-muted os-small">{wordCount(current.body)} words</span>
              {links.length > 0 && <span className="os-muted os-small">links → {links.join(', ')}</span>}
              {linkedFrom.length > 0 && (
                <span className="os-nt-back">
                  <span className="os-muted os-small">linked from</span>
                  {linkedFrom.map((n) => (
                    <button key={n.id} className="os-btn-link" onClick={() => setSelected(n.id)}>{titleOf(n.body)}</button>
                  ))}
                </span>
              )}
              <span className={`os-small ${saved ? 'os-ok' : 'os-warnc'}`}>{saved ? 'saved · encrypted' : 'saving…'}</span>
            </footer>
          </>
        ) : (
          <div className="os-nt-empty">
            <p className="os-title-sm">No note selected</p>
            <button className="os-btn os-btn-primary" onClick={() => newNote(folderFilter || '')}>New note</button>
          </div>
        )}
      </section>
    </div>
  )
}
