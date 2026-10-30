import { useEffect, useRef, useState } from 'react'
import { AppTile } from './AppTile.jsx'
import { AppBoundary } from './AppBoundary.jsx'
import { CloseIcon } from './icons.jsx'
import { whoosh, chime } from './sound.js'

// Window chrome and motion. States: 'shown' → 'minimizing' → 'hidden' → 'restoring' → 'shown'.
// Minimize flies the window into its dock icon. Restore flies it back out of the icon.
// The app stays mounted while hidden, so its state survives.
export const MIN_MS = 420
const RESTORE_MS = 440
const MENU_H = 40 // below the menu bar
const DOCK_RESERVE = 136 // above the dock, so a maximized window never covers it
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)'

function dockCenter(title) {
  const el = document.querySelector(`.os-dock-item[aria-label="${CSS.escape(title)}"]`)
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 40 }
}

export function WindowFrame({ win, app, active, onFocus, onClose, onMove, onResize, onMinimize, onToggleMax, children }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const center = useRef(null) // window centre captured when it starts to minimize
  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState(win.min ? 'hidden' : 'shown')
  const [fx, setFx] = useState(null)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 700

  // Close plays its animation first, then the window leaves the desktop state.
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 200)
  }

  // Minimize / restore: decide the flight from the state change.
  useEffect(() => {
    const flyTo = () => {
      const box = center.current
      const d = dockCenter(app.title)
      return `translate(${d.x - box.x}px, ${d.y - box.y}px) scale(0.08)`
    }
    if (win.min && (phase === 'shown' || phase === 'restoring')) {
      const r = ref.current.getBoundingClientRect()
      center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      setFx({ transform: flyTo(), opacity: 0, transition: `transform ${MIN_MS}ms ${EASE}, opacity ${MIN_MS}ms ease-in` })
      whoosh()
      setPhase('minimizing')
    } else if (!win.min && (phase === 'hidden' || phase === 'minimizing')) {
      chime()
      setFx({ transform: flyTo(), opacity: 0, transition: 'none' })
      setPhase('restoring')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.min])

  useEffect(() => {
    if (phase === 'minimizing') {
      const t = setTimeout(() => setPhase((p) => (p === 'minimizing' ? 'hidden' : p)), MIN_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'restoring') {
      let t
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setFx({ transform: 'none', opacity: 1, transition: `transform ${RESTORE_MS}ms ${EASE}, opacity 0.25s ease` })
          t = setTimeout(() => {
            setFx(null)
            setPhase('shown')
          }, RESTORE_MS)
        }),
      )
      return () => {
        cancelAnimationFrame(frame)
        clearTimeout(t)
      }
    }
    return undefined
  }, [phase])

  const maximized = Boolean(win.max) && !narrow

  const onPointerDown = (e) => {
    if (narrow || maximized || e.target.closest('button')) return
    onFocus()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const { sx, sy, ox, oy } = drag.current
    const x = Math.max(8, Math.min(ox + e.clientX - sx, window.innerWidth - 120))
    const y = Math.max(MENU_H, Math.min(oy + e.clientY - sy, window.innerHeight - 80))
    onMove(x, y)
  }
  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  let box
  if (narrow) box = { left: 8, top: 44, width: 'calc(100vw - 16px)', height: 'calc(100vh - 150px)' }
  else if (maximized) box = { left: 8, top: MENU_H, width: 'calc(100vw - 16px)', height: `calc(100vh - ${MENU_H + DOCK_RESERVE}px)` }
  else box = { left: win.x, top: win.y, width: win.w ?? app.w, height: win.h ?? app.h }

  // Resize from the bottom-right grip. Minimum 300 × 220, never past the screen. Double-click resets the size.
  const rs = useRef(null)
  const onResizeDown = (e) => {
    if (maximized || narrow) return
    e.stopPropagation()
    onFocus()
    rs.current = { sx: e.clientX, sy: e.clientY, w: win.w ?? app.w, h: win.h ?? app.h }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e) => {
    if (!rs.current) return
    const { sx, sy, w, h } = rs.current
    onResize(
      Math.max(300, Math.min(w + e.clientX - sx, window.innerWidth - win.x - 8)),
      Math.max(220, Math.min(h + e.clientY - sy, window.innerHeight - win.y - 110)),
    )
  }
  const onResizeUp = () => {
    rs.current = null
    setDragging(false)
  }

  const { Icon } = app
  return (
    <section
      ref={ref}
      className={`os-window ${active ? 'is-active' : ''} ${closing ? 'is-closing' : ''} ${dragging ? 'is-dragging' : ''} ${maximized ? 'is-max' : ''}`}
      style={{
        ...box,
        zIndex: 10 + win.z,
        '--tint': app.tint,
        display: phase === 'hidden' ? 'none' : undefined,
        ...(fx ? { transform: fx.transform, opacity: fx.opacity, transition: fx.transition } : null),
      }}
      onMouseDown={onFocus}
      aria-label={app.title}
      aria-hidden={phase === 'hidden' || undefined}
    >
      <header
        className="os-window-bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (!e.target.closest('button') && !narrow) onToggleMax()
        }}
      >
        <div className="os-lights">
          <button className="os-light os-light-red" aria-label={`Close ${app.title}`} onClick={requestClose}>
            <CloseIcon />
          </button>
          <button className="os-light os-light-yellow" aria-label={`Minimize ${app.title}`} onClick={onMinimize} />
          <button
            className="os-light os-light-green"
            aria-label={maximized ? `Restore ${app.title}` : `Full screen ${app.title}`}
            aria-pressed={maximized}
            onClick={onToggleMax}
            disabled={narrow}
          />
        </div>
        <div className="os-window-title">
          <AppTile Icon={Icon} grad={app.grad} size="sm" />
          {app.title}
        </div>
        <span className="os-window-spacer" aria-hidden="true" />
      </header>
      <div className="os-window-body">
        <AppBoundary name={app.title} onClose={requestClose}>{children}</AppBoundary>
      </div>
      <span
        className="os-grip"
        role="separator"
        aria-label="Resize window"
        title="Drag to resize · double-click to reset"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onDoubleClick={() => onResize(null, null)}
      />
    </section>
  )
}
