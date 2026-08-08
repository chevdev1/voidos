import { useEffect, useRef } from 'react'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * Draws a claimed constellation as lime nodes + MST lines.
 * With `interactive`, drag to orbit in 3D (yaw / pitch).
 */
export function LotFigure({
  lot,
  className = '',
  animate = true,
  interactive = false,
  autoSpin = true,
}) {
  const ref = useRef(null)
  const profile = buildLotProfile(lot)
  const viewRef = useRef({ yaw: 0.35, pitch: 0.28 })
  const dragRef = useRef(null)

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
      let x = s.x
      let y = s.y
      let z = s.z
      // yaw around Y
      const x1 = x * cy + z * sy
      const z1 = -x * sy + z * cy
      // pitch around X
      const y2 = y * cp - z1 * sp
      const z2 = y * sp + z1 * cp
      const scale = (Math.min(w, h) * 0.42) / (1.15 + z2 * 0.35)
      return {
        x: w * 0.5 + x1 * scale,
        y: h * 0.5 - y2 * scale,
        z: z2,
        r: s.r * (w / 170) * (1.05 - z2 * 0.15),
      }
    }

    function paint(now) {
      const w = canvas.width
      const h = canvas.height
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000

      if (interactive && autoSpin && !dragRef.current) {
        viewRef.current.yaw += dt * 0.35
      }

      const { yaw, pitch } = viewRef.current
      ctx.clearRect(0, 0, w, h)

      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.55)
      g.addColorStop(0, 'rgba(204,255,0,0.07)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      const pts = profile.stars.map((s) => project(s, w, h, yaw, pitch))
      const order = pts.map((_, i) => i).sort((a, b) => pts[a].z - pts[b].z)

      ctx.lineWidth = Math.max(1, w / 220)
      ctx.strokeStyle = 'rgba(204,255,0,0.5)'
      ctx.beginPath()
      for (const [a, b] of profile.edges) {
        ctx.moveTo(pts[a].x, pts[a].y)
        ctx.lineTo(pts[b].x, pts[b].y)
      }
      ctx.stroke()

      for (const i of order) {
        const p = pts[i]
        const pulse = animate ? 1 + Math.sin(t * 2.2 + i) * 0.18 : 1
        const alpha = 0.55 + (p.z + 0.6) * 0.25
        ctx.beginPath()
        ctx.fillStyle = `rgba(204,255,0,${0.12 + alpha * 0.12})`
        ctx.arc(p.x, p.y, p.r * 3.2 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.fillStyle = `rgba(204,255,0,${Math.min(1, 0.75 + alpha * 0.25)})`
        ctx.arc(p.x, p.y, Math.max(1.2, p.r * pulse), 0, Math.PI * 2)
        ctx.fill()
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
  }, [profile.id, profile.name, profile.kindId, animate, interactive, autoSpin])

  useEffect(() => {
    if (!interactive) return
    const canvas = ref.current
    if (!canvas) return

    function onDown(e) {
      e.preventDefault()
      const pt = e.touches ? e.touches[0] : e
      dragRef.current = {
        x: pt.clientX,
        y: pt.clientY,
        yaw: viewRef.current.yaw,
        pitch: viewRef.current.pitch,
      }
      canvas.setPointerCapture?.(e.pointerId)
    }
    function onMove(e) {
      if (!dragRef.current) return
      const pt = e.touches ? e.touches[0] : e
      const dx = pt.clientX - dragRef.current.x
      const dy = pt.clientY - dragRef.current.y
      viewRef.current.yaw = dragRef.current.yaw + dx * 0.01
      viewRef.current.pitch = Math.max(
        -1.1,
        Math.min(1.1, dragRef.current.pitch + dy * 0.008),
      )
    }
    function onUp() {
      dragRef.current = null
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
  }, [interactive])

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: interactive ? 'grab' : 'default',
        touchAction: interactive ? 'none' : undefined,
      }}
    />
  )
}

export { buildLotProfile, LOT_KINDS, getLotKind, kindIndexFromId } from '../../shared/lotLore.js'
