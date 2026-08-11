import { useEffect, useRef } from 'react'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * Sharp constellation figure — silhouette + mark style vary by kind.
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
  const kindCam = {
    spire: { yaw: 0.15, pitch: 0.08 },
    coil: { yaw: 0.85, pitch: 0.18 },
    crown: { yaw: 0.05, pitch: 0.35 },
    lattice: { yaw: 0.2, pitch: 0.55 },
    vein: { yaw: 0.12, pitch: 0.1 },
    halo: { yaw: 0.05, pitch: 0.9 },
  }[profile.kindId] || { yaw: 0.35, pitch: 0.2 }

  const viewRef = useRef({
    yaw: kindCam.yaw + (profile.id.charCodeAt(profile.id.length - 1) % 7) * 0.08,
    pitch: kindCam.pitch,
  })
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
      const scale = (Math.min(w, h) * 0.42) / (1.05 + z2 * 0.28)
      return {
        x: w * 0.5 + x1 * scale,
        y: h * 0.52 - y2 * scale,
        z: z2,
        r: Math.max(2.4, s.r * (w / 140) * (1.1 - z2 * 0.1)),
        index: s.index,
        name: s.name,
        mark: s.mark || 'diamond',
      }
    }

    function drawMark(p, r, sel) {
      const fill = sel ? '#f5ff9a' : '#ccff00'
      const stroke = sel ? 'rgba(245,255,154,0.95)' : 'rgba(204,255,0,0.8)'
      ctx.fillStyle = fill
      ctx.strokeStyle = stroke
      ctx.lineWidth = sel ? 1.6 : 1.1

      if (p.mark === 'circle') {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 0.85, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      if (p.mark === 'square') {
        const s = r * 1.1
        ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s)
        return
      }
      if (p.mark === 'triangle') {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y - r)
        ctx.lineTo(p.x + r * 0.95, p.y + r * 0.7)
        ctx.lineTo(p.x - r * 0.95, p.y + r * 0.7)
        ctx.closePath()
        ctx.fill()
        return
      }
      if (p.mark === 'plus') {
        ctx.beginPath()
        ctx.moveTo(p.x - r * 1.2, p.y)
        ctx.lineTo(p.x + r * 1.2, p.y)
        ctx.moveTo(p.x, p.y - r * 1.2)
        ctx.lineTo(p.x, p.y + r * 1.2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      if (p.mark === 'hex') {
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6
          const x = p.x + Math.cos(a) * r
          const y = p.y + Math.sin(a) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
        return
      }
      // diamond default
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1)
      ctx.restore()
      ctx.beginPath()
      ctx.moveTo(p.x - r * 1.2, p.y)
      ctx.lineTo(p.x + r * 1.2, p.y)
      ctx.moveTo(p.x, p.y - r * 1.2)
      ctx.lineTo(p.x, p.y + r * 1.2)
      ctx.stroke()
    }

    function paint(now) {
      const w = canvas.width
      const h = canvas.height
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000

      if (interactive && autoSpin && !dragRef.current) {
        viewRef.current.yaw += dt * 0.22
      }

      const { yaw, pitch } = viewRef.current
      ctx.clearRect(0, 0, w, h)

      // faint kind-tinted grid
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      const step = Math.max(22, w / 11)
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

      // kind-specific links
      const kind = profile.kindId
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (kind === 'coil' || kind === 'spire') {
        ctx.setLineDash([])
        ctx.lineWidth = Math.max(1.4, w / 160)
        ctx.strokeStyle = 'rgba(204,255,0,0.7)'
      } else if (kind === 'lattice') {
        ctx.setLineDash([])
        ctx.lineWidth = Math.max(1.2, w / 200)
        ctx.strokeStyle = 'rgba(204,255,0,0.55)'
      } else if (kind === 'halo') {
        ctx.setLineDash([])
        ctx.lineWidth = Math.max(1.1, w / 220)
        ctx.strokeStyle = 'rgba(204,255,0,0.5)'
      } else if (kind === 'vein') {
        ctx.setLineDash([])
        ctx.lineWidth = Math.max(1.5, w / 150)
        ctx.strokeStyle = 'rgba(204,255,0,0.65)'
      } else {
        // crown
        ctx.setLineDash([Math.max(3, w / 70), Math.max(2, w / 90)])
        ctx.lineWidth = Math.max(1.2, w / 190)
        ctx.strokeStyle = 'rgba(204,255,0,0.6)'
      }

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
        const tick = animate ? 1 + Math.sin(t * 2.2 + i * 0.85) * 0.07 : 1
        const r = Math.max(2.2, p.r * tick)
        drawMark(p, r, sel)

        if (sel || showLabels) {
          const label = `★${i + 1}`
          ctx.font = `${Math.max(9, w / 42)}px ui-monospace, monospace`
          ctx.fillStyle = sel ? '#f5ff9a' : 'rgba(204,255,0,0.7)'
          ctx.fillText(label, p.x + r * 1.5, p.y - r * 0.35)
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
        const d = Math.hypot(p.x - lx, p.y - ly)
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
