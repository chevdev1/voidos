import { useEffect, useRef } from 'react'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * Classic diamond sparkles + kind silhouette (same geometry as map figure overlay).
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
    spire: { yaw: 0.12, pitch: 0.06 },
    coil: { yaw: 0.75, pitch: 0.16 },
    crown: { yaw: 0.08, pitch: 0.28 },
    lattice: { yaw: 0.18, pitch: 0.5 },
    vein: { yaw: 0.1, pitch: 0.08 },
    halo: { yaw: 0.06, pitch: 0.85 },
  }[profile.kindId] || { yaw: 0.3, pitch: 0.18 }

  const viewRef = useRef({
    yaw: kindCam.yaw + (profile.id.charCodeAt(profile.id.length - 1) % 5) * 0.06,
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
      const scale = (Math.min(w, h) * 0.44) / (1.08 + z2 * 0.28)
      return {
        x: w * 0.5 + x1 * scale,
        y: h * 0.52 - y2 * scale,
        z: z2,
        r: Math.max(2.2, s.r * (w / 150) * (1.08 - z2 * 0.1)),
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
        viewRef.current.yaw += dt * 0.24
      }

      const { yaw, pitch } = viewRef.current
      ctx.clearRect(0, 0, w, h)

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

      // solid constellation links (same language as map)
      ctx.setLineDash([])
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(1.2, w / 200)
      ctx.strokeStyle = 'rgba(204,255,0,0.5)'
      ctx.beginPath()
      for (const [a, b] of profile.edges) {
        ctx.moveTo(pts[a].x, pts[a].y)
        ctx.lineTo(pts[b].x, pts[b].y)
      }
      ctx.stroke()

      for (const i of order) {
        const p = pts[i]
        const sel = selectedStar === i
        const tick = animate ? 1 + Math.sin(t * 2.4 + i * 0.9) * 0.08 : 1
        const r = Math.max(2.2, p.r * tick)

        // soft halo under spark
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6)
        grd.addColorStop(0, sel ? 'rgba(245,255,154,0.28)' : 'rgba(204,255,0,0.18)')
        grd.addColorStop(1, 'rgba(204,255,0,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2)
        ctx.fill()

        // classic hard diamond + cross sparkle
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = sel ? '#f5ff9a' : '#ccff00'
        ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1)
        ctx.restore()

        ctx.beginPath()
        ctx.strokeStyle = sel ? 'rgba(245,255,154,0.95)' : 'rgba(204,255,0,0.8)'
        ctx.lineWidth = sel ? 1.5 : 1.1
        ctx.moveTo(p.x - r * 1.4, p.y)
        ctx.lineTo(p.x + r * 1.4, p.y)
        ctx.moveTo(p.x, p.y - r * 1.4)
        ctx.lineTo(p.x, p.y + r * 1.4)
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
