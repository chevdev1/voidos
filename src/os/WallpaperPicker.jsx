import { useRef, useState } from 'react'
import { WALLPAPERS, readCustom, writeCustom, prepareImage } from './wallpapers.js'
import { savePrefs } from './prefs.js'

// Settings → Wallpaper: a gallery of desktop backgrounds, plus your own image. Like the iPhone's wallpaper page.
export function WallpaperPicker({ prefs, setPrefs }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [custom, setCustom] = useState(() => readCustom())

  const choose = (id) => {
    const next = { ...prefs, wallpaperKind: id, wallpaper: true }
    setPrefs(next)
    savePrefs(next)
  }

  async function upload(file) {
    setError('')
    setBusy(true)
    try {
      const data = await prepareImage(file)
      if (!writeCustom(data)) throw new Error('Could not save the image on this device.')
      setCustom(data)
      choose('custom')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="os-wp-picker">
      <div className="os-wp-grid" role="radiogroup" aria-label="Wallpaper">
        {WALLPAPERS.map((w) => {
          const on = prefs.wallpaperKind === w.id
          const disabled = w.id === 'custom' && !custom
          return (
            <button
              key={w.id}
              role="radio"
              aria-checked={on}
              disabled={disabled}
              className={`os-wp-card ${on ? 'is-on' : ''}`}
              onClick={() => choose(w.id)}
            >
              <span
                className={`os-wp-thumb ${w.css}`}
                style={w.id === 'custom' && custom ? { backgroundImage: `url(${custom})`, backgroundSize: 'cover' } : w.thumb ? { backgroundImage: `url(${w.thumb})`, backgroundSize: 'cover' } : undefined}
                aria-hidden="true"
              >
                {w.id === 'custom' && !custom && <span className="os-wp-empty">Add an image</span>}
              </span>
              <span className="os-wp-name">{w.name}</span>
            </button>
          )
        })}
      </div>

      <div className="os-row os-between">
        <button className="os-btn os-btn-primary" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Preparing…' : 'Choose an image…'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
        <span className="os-muted os-small">Your image is resized and stays on this device.</span>
      </div>
      {error && <p className="os-error" role="alert">{error}</p>}
    </div>
  )
}
