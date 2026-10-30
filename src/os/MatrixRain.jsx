import { useEffect, useRef } from 'react'

const GLYPHS = '01アイウエオカキクケコサシスセソタチツテトVOID$#%&<>/\\|'

// Full-cover matrix rain. Calls onDone after `duration` ms (fade-out included).
// Under prefers-reduced-motion it skips the animation and calls onDone right away.
export function MatrixRain({ duration = 2200, onDone, label }) {
  const canvasRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => doneRef.current?.(), 300)
      return () => clearTimeout(t)
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const size = 15
    let cols = 0
    let drops = []
    let raf = 0
    let start = 0
    let last = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(canvas.clientWidth / size)
      drops = Array.from({ length: cols }, () => Math.random() * -40)
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    }

    const frame = (t) => {
      if (!start) start = t
      // ~24 fps is plenty for the rain look and keeps the window responsive.
      if (t - last > 40) {
        last = t
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        ctx.fillStyle = 'rgba(5,5,5,0.22)'
        ctx.fillRect(0, 0, w, h)
        ctx.font = `${size - 2}px "IBM Plex Mono", monospace`
        for (let i = 0; i < cols; i++) {
          const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          const y = drops[i] * size
          const head = Math.random() > 0.97
          ctx.fillStyle = head ? '#f0f0f0' : 'rgba(204,255,0,0.85)'
          ctx.fillText(ch, i * size, y)
          if (y > h && Math.random() > 0.975) drops[i] = 0
          drops[i] += 1
        }
      }
      const elapsed = t - start
      if (elapsed < duration) raf = requestAnimationFrame(frame)
      else doneRef.current?.()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [duration])

  return (
    <div className="os-matrix" role="status" aria-live="polite">
      <canvas ref={canvasRef} className="os-matrix-canvas" />
      {label && <div className="os-matrix-label">{label}</div>}
    </div>
  )
}
