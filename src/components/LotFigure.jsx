import { useEffect, useRef } from 'react'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * Sharp constellation figure — no soft glow.
 * Interactive: drag to orbit; click a star to select (onSelectStar).
 */
export function LotFigure({
  lot,
  className = '',
  animate = true,
  interactive = false,
  autoSpin = true,
  selectedStar = null,
  onSelectStar,
  showLabels = false,
}) {
  const ref = useRef(null)
  const profile = buildLotProfile(lot)
  const viewRef = useRef({ yaw: 0.45, pitch: 0.22 })
  const dragRef = useRef(null)
  const ptsRef = useRef([])
  const movedRef = useRef(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let t0 = performance.now()
    let last = t0

    function project(s, w, h, yaw, pitch) {
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const x1 = s.x * cy + s.z * sy
      const z1 = -s.x * sy + s.z * cy
      const y2 = s.y * cp - z1 * sp
      const z2 = s.y * sp + z1 * cp
      const scale = (Math.min(w, h) * 0.44) / (1.12 + z2 * 0.32)
      return {
        x: w * 0.5 + x1 * scale,
        y: h * 0.5 - y2 * scale,
        z: z2,
        r: Math.max(2.2, s.r * (w / 155) * (1.08 - z2 * 0.12)),
        index: s.index,
        name: s.name,
      }
    }

    function paint(now) {
      const w = canvas.width
      const h = canvas.height
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000

      if (interactive && autoSpin && !dragRef.current) {
        viewRef.current.yaw += dt * 0.28
      }

      const { yaw, pitch } = viewRef.current
      ctx.clearRect(0, 0, w, h)

      // subtle grid / void grain — no lime bloom
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      const step = Math.max(24, w / 12)
      for (let x = 0; x < w; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const pts = profile.stars.map((s) => project(s, w, h, yaw, pitch))
      ptsRef.current = pts
      const order = pts.map((_, i) => i).sort((a, b) => pts[a].z - pts[b].z)

      // thin hard links
      ctx.setLineDash([Math.max(2, w / 90), Math.max(3, w / 70)])
      ctx.lineWidth = Math.max(1, w / 280)
      ctx.strokeStyle = 'rgba(204,255,0,0.55)'
      ctx.beginPath()
      for (const [a, b] of profile.edges) {
        ctx.moveTo(pts[a].x, pts[a].y)
        ctx.lineTo(pts[b].x, pts[b].y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      for (const i of order) {
        const p = pts[i]
        const sel = selectedStar === i
        const tick = animate ? 1 + Math.sin(t * 2.4 + i * 0.9) * 0.08 : 1
        const r = Math.max(2, p.r * tick)

        // hard diamond / cross core — no soft aura
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = sel ? '#f5ff9a' : '#ccff00'
        ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1)
        ctx.restore()

        ctx.beginPath()
        ctx.strokeStyle = sel ? 'rgba(245,255,154,0.95)' : 'rgba(204,255,0,0.75)'
        ctx.lineWidth = sel ? 1.5 : 1
        ctx.moveTo(p.x - r * 1.35, p.y)
        ctx.lineTo(p.x + r * 1.35, p.y)
        ctx.moveTo(p.x, p.y - r * 1.35)
        ctx.lineTo(p.x, p.y + r * 1.35)
        ctx.stroke()

        if (sel || showLabels) {
          const label = `★${i + 1}`
          ctx.font = `${Math.max(9, w / 42)}px ui-monospace, monospace`
          ctx.fillStyle = sel ? '#f5ff9a' : 'rgba(204,255,0,0.7)'
          ctx.fillText(label, p.x + r * 1.6, p.y - r * 0.4)
        }
      }

      if (animate || (interactive && autoSpin)) raf = requestAnimationFrame(paint)
    }

    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      paint(performance.now())
    })
    ro.observe(canvas)
    paint(performance.now())

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [
    profile.id,
    profile.name,
    profile.kindId,
    animate,
    interactive,
    autoSpin,
    selectedStar,
    showLabels,
  ])

  useEffect(() => {
    if (!interactive && !onSelectStar) return
    const canvas = ref.current
    if (!canvas) return

    function localPoint(e) {
      const rect = canvas.getBoundingClientRect()
      const pt = e.touches ? e.touches[0] : e
      const dpr = canvas.width / Math.max(1, rect.width)
      return {
        x: (pt.clientX - rect.left) * dpr,
        y: (pt.clientY - rect.top) * dpr,
        clientX: pt.clientX,
        clientY: pt.clientY,
      }
    }

    function hitStar(lx, ly) {
      let best = null
      for (let i = 0; i < ptsRef.current.length; i++) {
        const p = ptsRef.current[i]
        const dx = p.x - lx
        const dy = p.y - ly
        const d = Math.hypot(dx, dy)
        const thresh = Math.max(14, p.r * 3.2)
        if (d <= thresh && (!best || d < best.d)) best = { i, d }
      }
      return best?.i ?? null
    }

    function onDown(e) {
      e.preventDefault()
      const p = localPoint(e)
      movedRef.current = false
      dragRef.current = {
        x: p.clientX,
        y: p.clientY,
        yaw: viewRef.current.yaw,
        pitch: viewRef.current.pitch,
        hit: hitStar(p.x, p.y),
      }
      canvas.setPointerCapture?.(e.pointerId)
    }
    function onMove(e) {
      if (!dragRef.current) return
      const p = localPoint(e)
      const dx = p.clientX - dragRef.current.x
      const dy = p.clientY - dragRef.current.y
      if (Math.hypot(dx, dy) > 6) movedRef.current = true
      if (interactive) {
        viewRef.current.yaw = dragRef.current.yaw + dx * 0.01
        viewRef.current.pitch = Math.max(
          -1.1,
          Math.min(1.1, dragRef.current.pitch + dy * 0.008),
        )
      }
    }
    function onUp(e) {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || movedRef.current || !onSelectStar) return
      const p = localPoint(e)
      const i = hitStar(p.x, p.y)
      if (i != null) onSelectStar(i, profile.stars[i])
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('lostpointercapture', onUp)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('lostpointercapture', onUp)
    }
  }, [interactive, onSelectStar, profile.stars])

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: interactive || onSelectStar ? 'crosshair' : 'default',
        touchAction: interactive ? 'none' : undefined,
      }}
    />
  )
}

export { buildLotProfile, LOT_KINDS, getLotKind, kindIndexFromId, getStarFromLot } from '../../shared/lotLore.js'
