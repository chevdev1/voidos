import { useEffect, useRef, useState } from 'react'
import { AppTile } from './AppTile.jsx'
import { AppBoundary } from './AppBoundary.jsx'
import { CloseIcon } from './icons.jsx'
import { whoosh, chime } from './sound.js'
import { resizeBox, MENU_H } from './geometry.js'

// Window chrome and motion. States: 'shown' → 'minimizing' → 'hidden' → 'restoring' → 'shown'.
// Minimize flies the window into its dock icon. Restore flies it back out of the icon.
// The app stays mounted while hidden, so its state survives.
//
// Performance: while the pointer drags or resizes, the element is moved directly in the DOM.
// React state is written once, on release. That keeps a drag from re-rendering the whole desktop.
export const MIN_MS = 420
const RESTORE_MS = 440
const DOCK_RESERVE = 136 // above the dock, so a maximized window never covers it
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)'

// Which themed cursor a handle shows. Move uses the closed hand.
const AXIS = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw' }
const CURSOR_CLASSES = ['os-cursor-grab', 'os-cursor-ns', 'os-cursor-ew', 'os-cursor-nwse', 'os-cursor-nesw']

// Each handle says which edges it moves: [left, top, right, bottom] as 0/1 flags.
const HANDLES = [
  { id: 'n', cls: 'is-n', e: [0, 1, 0, 0], cursor: 'ns-resize' },
  { id: 's', cls: 'is-s', e: [0, 0, 0, 1], cursor: 'ns-resize' },
  { id: 'e', cls: 'is-e', e: [0, 0, 1, 0], cursor: 'ew-resize' },
  { id: 'w', cls: 'is-w', e: [1, 0, 0, 0], cursor: 'ew-resize' },
  { id: 'nw', cls: 'is-nw', e: [1, 1, 0, 0], cursor: 'nwse-resize' },
  { id: 'se', cls: 'is-se', e: [0, 0, 1, 1], cursor: 'nwse-resize' },
  { id: 'ne', cls: 'is-ne', e: [0, 1, 1, 0], cursor: 'nesw-resize' },
  { id: 'sw', cls: 'is-sw', e: [1, 0, 0, 1], cursor: 'nesw-resize' },
]

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
  const drag = useRef(null) // { kind: 'move'|'resize', ... } while the pointer is down
  const center = useRef(null) // window centre captured when it starts to minimize
  const [closing, setClosing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [phase, setPhase] = useState(win.min ? 'hidden' : 'shown')
  const [fx, setFx] = useState(null)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 700

  const width = win.w ?? app.w
  const height = win.h ?? app.h
  const maximized = Boolean(win.max) && !narrow

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
      whoosh()
      setFx({ transform: flyTo(), opacity: 0, transition: `transform ${MIN_MS}ms ${EASE}, opacity ${MIN_MS}ms ease-in` })
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

  // The box comes from React, except while the pointer is moving it: then the DOM already holds the live value.
  const place = (x, y, w, h) => {
    const s = ref.current?.style
    if (!s) return
    s.left = `${x}px`
    s.top = `${y}px`
    s.width = `${w}px`
    s.height = `${h}px`
  }

  const screen = () => ({ w: window.innerWidth, h: window.innerHeight })

  const startDrag = (e, kind, edges, axis) => {
    if (narrow || maximized) return
    e.stopPropagation()
    onFocus()
    const el = ref.current
    document.documentElement.classList.add(kind === 'move' ? 'os-cursor-grab' : `os-cursor-${axis}`)
    drag.current = {
      kind,
      edges,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      start: { x: win.x, y: win.y, w: width, h: height },
      last: { x: win.x, y: win.y, w: width, h: height },
    }
    el.setPointerCapture?.(e.pointerId)
    setMoving(true)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (d.kind === 'move') {
      const x = Math.max(8, Math.min(d.start.x + dx, window.innerWidth - 120))
      const y = Math.max(MENU_H, Math.min(d.start.y + dy, window.innerHeight - 80))
      d.last = { ...d.last, x, y }
      place(x, y, d.start.w, d.start.h)
    } else {
      const box = resizeBox(d.start, d.edges, dx, dy, screen())
      d.last = box
      place(box.x, box.y, box.w, box.h)
    }
  }

  const endDrag = (e) => {
    const d = drag.current
    if (!d || (e && e.pointerId !== d.pid)) return
    drag.current = null
    document.documentElement.classList.remove(...CURSOR_CLASSES)
    setMoving(false)
    if (d.kind === 'move') onMove(d.last.x, d.last.y)
    else onResize(d.last.w, d.last.h, d.last.x, d.last.y)
  }

  const onHeaderDown = (e) => {
    if (e.target.closest('button')) return
    startDrag(e, 'move', null)
  }

  let box
  if (narrow) box = { left: 8, top: 44, width: 'calc(100vw - 16px)', height: 'calc(100vh - 150px)' }
  else if (maximized) box = { left: 8, top: MENU_H, width: 'calc(100vw - 16px)', height: `calc(100vh - ${MENU_H + DOCK_RESERVE}px)` }
  else box = { left: win.x, top: win.y, width, height }

  const { Icon } = app
  return (
    <section
      ref={ref}
      className={`os-window ${active ? 'is-active' : ''} ${closing ? 'is-closing' : ''} ${moving ? 'is-dragging' : ''} ${maximized ? 'is-max' : ''}`}
      style={{
        ...box,
        zIndex: 10 + win.z,
        '--tint': app.tint,
        display: phase === 'hidden' ? 'none' : undefined,
        ...(fx ? { transform: fx.transform, opacity: fx.opacity, transition: fx.transition } : null),
      }}
      onMouseDown={onFocus}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label={app.title}
      aria-hidden={phase === 'hidden' || undefined}
    >
      <header
        className="os-window-bar"
        onPointerDown={onHeaderDown}
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

      {/* Eight handles: every edge and corner. Hidden when maximized or on narrow screens. */}
      {!maximized &&
        !narrow &&
        HANDLES.map((h) => (
          <span
            key={h.id}
            className={`os-handle ${h.cls}`}
            role="separator"
            aria-label={`Resize ${app.title} from the ${h.id} edge`}
            onPointerDown={(e) => startDrag(e, 'resize', h.e, AXIS[h.id])}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onResize(null, null, null, null)
            }}
          />
        ))}
    </section>
  )
}
