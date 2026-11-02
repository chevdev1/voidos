import { useEffect, useMemo, useRef, useState } from 'react'
import { loadTree, saveTree, listDir, nodeAt, create, removeEntry, writeFile, readFile, crumbsOf } from './store.js'

// Files: the desktop's folders. Double-click a folder to open it; a text file opens in the editor beside the list.
// Everything is saved on this device as you type.
export function Files({ payload }) {
  const [tree, setTree] = useState(() => loadTree())
  const [path, setPath] = useState(() => (Array.isArray(payload?.path) ? payload.path : []))
  const [sel, setSel] = useState(null) // name of the selected entry
  const [draft, setDraft] = useState(null) // { type: 'dir'|'file', value, error }
  const inputRef = useRef(null)

  // Opened from the desktop with a specific folder.
  useEffect(() => {
    if (Array.isArray(payload?.path)) {
      setPath(payload.path)
      setSel(null)
    }
  }, [payload?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const entries = useMemo(() => listDir(tree, path), [tree, path])
  const selType = sel ? entries.find((e) => e.name === sel)?.type : null
  const text = selType === 'file' ? readFile(tree, path, sel) : null

  function commit(next) {
    setTree(next)
    saveTree(next)
  }

  function open(entry) {
    if (entry.type === 'dir') {
      setPath([...path, entry.name])
      setSel(null)
    } else {
      setSel(entry.name)
    }
  }

  function up() {
    setPath(path.slice(0, -1))
    setSel(null)
  }

  function confirmDraft() {
    if (!draft) return
    const res = create(tree, path, draft.value, draft.type)
    if (res.error) return setDraft({ ...draft, error: res.error })
    commit(res.tree)
    setSel(draft.value.trim())
    setDraft(null)
  }

  function remove(name) {
    commit(removeEntry(tree, path, name))
    if (sel === name) setSel(null)
  }

  useEffect(() => {
    if (draft) inputRef.current?.focus()
  }, [draft])

  // Missing folder (for example after an edit elsewhere): show the root.
  useEffect(() => {
    if (!nodeAt(tree, path)) {
      setPath([])
      setSel(null)
    }
  }, [tree, path])

  return (
    <div className="os-files">
      <header className="os-files-bar">
        <button className="os-btn" onClick={up} disabled={path.length === 0} aria-label="Up one folder">↑</button>
        <nav className="os-files-crumbs" aria-label="Location">
          {crumbsOf(path).map((c, i, all) => (
            <button
              key={i}
              className="os-files-crumb"
              disabled={i === all.length - 1}
              onClick={() => { setPath(path.slice(0, i)); setSel(null) }}
            >
              {c}
              {i < all.length - 1 && <span className="os-muted"> › </span>}
            </button>
          ))}
        </nav>
        <div className="os-row">
          <button className="os-btn" onClick={() => setDraft({ type: 'dir', value: '', error: '' })}>New folder</button>
          <button className="os-btn" onClick={() => setDraft({ type: 'file', value: 'Untitled.txt', error: '' })}>New file</button>
        </div>
      </header>

      <div className="os-files-body">
        <div className="os-files-grid" role="list" aria-label={`Contents of ${crumbsOf(path).join(' / ')}`}>
          {draft && (
            <div className="os-files-draft" role="listitem">
              <input
                ref={inputRef}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value, error: '' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmDraft()
                  if (e.key === 'Escape') setDraft(null)
                }}
                onBlur={() => setDraft(null)}
                aria-label={draft.type === 'dir' ? 'New folder name' : 'New file name'}
                spellCheck={false}
              />
              {draft.error && <span className="os-files-err" role="alert">{draft.error}</span>}
            </div>
          )}
          {entries.map((e) => (
            <div key={e.name} className="os-files-item" role="listitem">
              <button
                className={`os-files-cell ${sel === e.name ? 'is-on' : ''}`}
                onClick={() => setSel(e.name)}
                onDoubleClick={() => open(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') open(e)
                  if (ev.key === 'Delete') remove(e.name)
                }}
                aria-label={`${e.type === 'dir' ? 'Folder' : 'File'} ${e.name}`}
              >
                <span className={`os-files-glyph ${e.type === 'dir' ? 'is-dir' : ''}`} aria-hidden="true">{e.type === 'dir' ? '▰' : '▤'}</span>
                <span className="os-files-name">{e.name}</span>
              </button>
              <button className="os-files-x" aria-label={`Delete ${e.name}`} onClick={() => remove(e.name)}>×</button>
            </div>
          ))}
          {!entries.length && !draft && <p className="os-muted os-small os-files-empty">This folder is empty. Use New folder or New file.</p>}
        </div>

        {selType === 'file' && (
          <section className="os-files-editor" aria-label={`Editing ${sel}`}>
            <div className="os-files-editor-head">
              <b>{sel}</b>
              <span className="os-muted os-small">saved on this device</span>
            </div>
            <textarea
              value={text ?? ''}
              onChange={(e) => commit(writeFile(tree, path, sel, e.target.value))}
              spellCheck={false}
              aria-label={`Text of ${sel}`}
            />
          </section>
        )}
      </div>
    </div>
  )
}
