import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Live page from the browser gateway (gateway/index.mjs). Frames come in as JPEG, input goes back.
import { GATEWAY_URL, VIEW } from './gateway.js'
const MOVE_EVERY_MS = 40

export const RemoteBrowser = forwardRef(function RemoteBrowser({ url, onUrl, visible = true }, ref) {
  const canvas = useRef(null)
  const ws = useRef(null)
  const ready = useRef(false)
  const lastSent = useRef(null)
  const pending = useRef(null) // latest frame waiting to be drawn
  const drawing = useRef(false)
  const lastMove = useRef(0)
  const onUrlRef = useRef(onUrl)
  onUrlRef.current = onUrl
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState('')

  const send = (msg) => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg))
  }

  // Draw the newest frame only: decoding is async, so older frames are dropped while one is in flight.
  async function paint() {
    if (drawing.current || !pending.current) return
    drawing.current = true
    const data = pending.current
    pending.current = null
    try {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
      const ctx = canvas.current?.getContext('2d')
      if (ctx) ctx.drawImage(bitmap, 0, 0, VIEW.width, VIEW.height)
      bitmap.close?.()
    } catch {
      /* a bad frame is skipped, the next one replaces it */
    } finally {
      drawing.current = false
      if (pending.current) paint()
    }
  }

  useEffect(() => {
    const socket = new WebSocket(GATEWAY_URL)
    ws.current = socket
    socket.onopen = () => {
      ready.current = true
      setStatus('live')
      if (url) {
        lastSent.current = url
        send({ type: 'open', url })
      }
    }
    socket.onmessage = (event) => {
      let m
      try {
        m = JSON.parse(event.data)
      } catch {
        return
      }
      if (m.type === 'frame') {
        pending.current = m.data
        paint()
      } else if (m.type === 'url') {
        onUrlRef.current?.(m)
      } else if (m.type === 'error') {
        setError(m.message)
      }
    }
    socket.onerror = () => setStatus('unavailable')
    socket.onclose = () => {
      ready.current = false
      setStatus((s) => (s === 'unavailable' ? s : 'closed'))
    }
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new address in the same tab navigates the existing page.
  useEffect(() => {
    if (!ready.current || !url || url === lastSent.current) return
    lastSent.current = url
    setError('')
    send({ type: 'open', url })
  }, [url])

  useImperativeHandle(ref, () => ({
    back: () => send({ type: 'nav', action: 'back' }),
    forward: () => send({ type: 'nav', action: 'forward' }),
    reload: () => send({ type: 'nav', action: 'reload' }),
  }))

  // Map a pointer position on the displayed canvas to the page's own pixels.
  const toPage = (e) => {
    const rect = canvas.current.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - rect.left) * VIEW.width) / rect.width),
      y: Math.round(((e.clientY - rect.top) * VIEW.height) / rect.height),
    }
  }

  // Wheel must be non-passive so the page scrolls and the window does not.
  useEffect(() => {
    const el = canvas.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      send({ type: 'wheel', dx: Math.round(e.deltaX), dy: Math.round(e.deltaY) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="os-remote" hidden={!visible}>
      {status !== 'live' && (
        <div className="os-remote-state" role="status">
          {status === 'connecting' && 'Connecting to the browser gateway…'}
          {status === 'closed' && 'Session ended (idle or closed). Open the address again.'}
          {status === 'unavailable' && 'Browser gateway is not running. Start it with: npm start in the gateway folder.'}
        </div>
      )}
      {error && <p className="os-browser-note is-warn" role="alert">{error}</p>}
      <canvas
        ref={canvas}
        className="os-remote-canvas"
        width={VIEW.width}
        height={VIEW.height}
        tabIndex={0}
        aria-label="Live web page. Click to interact, type to enter text."
        onPointerDown={(e) => {
          e.currentTarget.focus()
          const p = toPage(e)
          send({ type: 'mouse', kind: 'down', button: e.button, ...p })
        }}
        onPointerUp={(e) => send({ type: 'mouse', kind: 'up', button: e.button, ...toPage(e) })}
        onPointerMove={(e) => {
          const now = performance.now()
          if (now - lastMove.current < MOVE_EVERY_MS) return
          lastMove.current = now
          send({ type: 'mouse', kind: 'move', ...toPage(e) })
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          e.preventDefault()
          if (!e.repeat) send({ type: 'key', kind: 'down', key: e.key })
        }}
        onKeyUp={(e) => {
          e.preventDefault()
          send({ type: 'key', kind: 'up', key: e.key })
        }}
      />
    </div>
  )
})
