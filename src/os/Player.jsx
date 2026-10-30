import { useEffect, useRef, useSyncExternalStore, useState } from 'react'
import { BUILTIN, getPlayer, subscribePlayer, play, toggle, next, prev, selectBuiltin, selectFile, setVolume, seek, addFiles, removeFile } from './player.js'

const FIRST_RUN_KEY = 'void-os-player-seen'

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export function Player() {
  const p = useSyncExternalStore(subscribePlayer, getPlayer, getPlayer)
  const [dragOver, setDragOver] = useState(false)
  const input = useRef(null)

  // First time the player opens, the music starts on its own. Opening the window is the user gesture that allows it.
  useEffect(() => {
    try {
      if (!localStorage.getItem(FIRST_RUN_KEY)) {
        localStorage.setItem(FIRST_RUN_KEY, '1')
        if (!getPlayer().playing) play()
      }
    } catch {
      /* storage blocked: skip the first-run start */
    }
  }, [])

  const current = p.mode === 'builtin' ? BUILTIN[p.trackIndex] : p.files[p.fileIndex]
  const title = current ? current.title || current.name : 'Nothing selected'
  const sub = p.mode === 'builtin' ? BUILTIN[p.trackIndex].sub : 'your file · plays on this device'

  return (
    <div
      className={`os-player ${p.playing ? 'is-playing' : ''} ${dragOver ? 'is-drop' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        addFiles(e.dataTransfer.files)
      }}
    >
      <div className="os-player-now">
        <div className="os-player-cover" aria-hidden="true">
          <span className="os-player-disc" />
        </div>
        <div className="os-player-meta">
          <span className="os-label">{p.playing ? 'Now playing' : 'Paused'}</span>
          <b className="os-player-title">{title}</b>
          <span className="os-muted os-small">{sub}</span>
        </div>
      </div>

      {p.mode === 'file' && current ? (
        <div className="os-player-progress">
          <input
            type="range"
            min={0}
            max={p.duration || 0}
            step={0.1}
            value={Math.min(p.elapsed, p.duration || p.elapsed)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
          <div className="os-row os-between os-small os-mono">
            <span>{fmt(p.elapsed)}</span>
            <span>{fmt(p.duration)}</span>
          </div>
        </div>
      ) : (
        <div className="os-row os-between os-small os-mono os-muted os-player-live">
          <span>live · generated</span>
          <span>{fmt(p.elapsed)}</span>
        </div>
      )}

      <div className="os-player-controls">
        <button className="os-player-btn" onClick={prev} aria-label="Previous">‹‹</button>
        <button className="os-player-btn is-main" onClick={toggle} aria-label={p.playing ? 'Pause' : 'Play'}>
          {p.playing ? '❚❚' : '▶'}
        </button>
        <button className="os-player-btn" onClick={next} aria-label="Next">››</button>
        <label className="os-player-vol">
          <span aria-hidden="true">♪</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={p.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </label>
      </div>

      {p.error && <p className="os-error" role="alert">{p.error}</p>}

      <div className="os-player-list" role="list" aria-label="Playlist">
        <span className="os-label">Built-in ambient</span>
        {BUILTIN.map((t, i) => (
          <button
            key={t.id}
            role="listitem"
            className={`os-player-row ${p.mode === 'builtin' && p.trackIndex === i ? 'is-on' : ''}`}
            onClick={() => selectBuiltin(i)}
          >
            <span>{t.title}</span>
            <span className="os-muted os-small">{t.sub.replace('generative ambient · ', '')}</span>
          </button>
        ))}

        <span className="os-label">Your MP3s</span>
        {p.files.length === 0 && <span className="os-muted os-small">Drop audio files here, or add them. They stay on this device.</span>}
        {p.files.map((f, i) => (
          <div key={f.id} role="listitem" className={`os-player-row is-file ${p.mode === 'file' && p.fileIndex === i ? 'is-on' : ''}`}>
            <button className="os-player-pick" onClick={() => selectFile(i)}>{f.name}</button>
            <button className="os-tab-x" aria-label={`Remove ${f.name}`} onClick={() => removeFile(i)}>×</button>
          </div>
        ))}
        <div className="os-row">
          <button className="os-btn" onClick={() => input.current?.click()}>Add audio…</button>
          <input
            ref={input}
            type="file"
            accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <span className="os-muted os-small">or drop files on this window</span>
        </div>
      </div>
      <p className="os-note">Built-in ambient is generated on your device. Files you add are never uploaded.</p>
    </div>
  )
}
