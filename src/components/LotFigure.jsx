import { useEffect, useRef } from 'react'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * Draws a claimed constellation as lime nodes + MST lines.
 */
export function LotFigure({ lot, className = '', animate = true }) {
  const ref = useRef(null)
  const profile = buildLotProfile(lot)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let t0 = performance.now()

    function paint(now) {
      const w = canvas.width
      const h = canvas.height
      const t = (now - t0) / 1000
      ctx.clearRect(0, 0, w, h)

      // soft void wash
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.55)
      g.addColorStop(0, 'rgba(204,255,0,0.06)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      const pts = profile.stars.map((s) => ({
        x: s.x * w,
        y: s.y * h,
        r: s.r * (w / 160),
      }))

      ctx.lineWidth = Math.max(1, w / 220)
      ctx.strokeStyle = 'rgba(204,255,0,0.55)'
      ctx.beginPath()
      for (const [a, b] of profile.edges) {
        ctx.moveTo(pts[a].x, pts[a].y)
        ctx.lineTo(pts[b].x, pts[b].y)
      }
      ctx.stroke()

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const pulse = animate ? 1 + Math.sin(t * 2.2 + i) * 0.18 : 1
        ctx.beginPath()
        ctx.fillStyle = 'rgba(204,255,0,0.2)'
        ctx.arc(p.x, p.y, p.r * 3.2 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.fillStyle = '#ccff00'
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2)
        ctx.fill()
      }

      if (animate) raf = requestAnimationFrame(paint)
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
  }, [profile.id, profile.name, animate])

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

export { buildLotProfile }
