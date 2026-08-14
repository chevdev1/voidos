import { useEffect, useRef } from 'react'

/**
 * VOID-styled candle canvas — lime up / red down, no third-party chart chrome.
 */
export function VoidChart({ candles = [], emptyHint = 'no prints yet', tf = '' }) {
  const boxRef = useRef(null)
  const cnvRef = useRef(null)

  useEffect(() => {
    const box = boxRef.current
    const cnv = cnvRef.current
    if (!box || !cnv) return
    const ctx = cnv.getContext('2d')
    if (!ctx) return

    function draw() {
      const rect = box.getBoundingClientRect()
      const W = Math.round(box.clientWidth || rect.width)
      const H = Math.round(box.clientHeight || rect.height)
      if (!W || !H) return false
      const d = Math.min(window.devicePixelRatio || 1, 2)
      cnv.width = W * d
      cnv.height = H * d
      cnv.style.width = W + 'px'
      cnv.style.height = H + 'px'
      ctx.setTransform(d, 0, 0, d, 0, 0)
      ctx.clearRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(204,255,0,0.08)'
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const y = (H / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      if (!candles.length) return true

      let lo = Infinity
      let hi = -Infinity
      for (const k of candles) {
        lo = Math.min(lo, k.l)
        hi = Math.max(hi, k.h)
      }
      const span = hi - lo || Math.max(Math.abs(hi) * 0.04, 1e-12)
      lo -= span * 0.12
      hi += span * 0.12
      const y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * (H - 28)

      if (candles.length < 3) {
        const pts = candles.map((k, i) => {
          const x =
            candles.length === 1 ? W / 2 : (i / Math.max(candles.length - 1, 1)) * (W - 16) + 8
          return { x, y: y(k.c) }
        })
        if (candles.length === 1) {
          pts.unshift({ x: 8, y: pts[0].y })
          pts.push({ x: W - 8, y: pts[0].y })
        }
        ctx.beginPath()
        ctx.moveTo(pts[0].x, H - 8)
        ctx.lineTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.lineTo(pts.at(-1).x, H - 8)
        ctx.closePath()
        ctx.fillStyle = 'rgba(204,255,0,0.12)'
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.strokeStyle = '#ccff00'
        ctx.lineWidth = 1.5
        ctx.stroke()
        return true
      }

      const n = candles.length
      const slot = W / n
      const bw = Math.max(2, slot * 0.55)

      for (let i = 0; i < n; i++) {
        const k = candles[i]
        const x = i * slot + slot / 2
        const up = k.c >= k.o
        const col = up ? '#ccff00' : '#ff4d5e'
        ctx.strokeStyle = col
        ctx.beginPath()
        ctx.moveTo(x, y(k.h))
        ctx.lineTo(x, y(k.l))
        ctx.stroke()
        ctx.fillStyle = col
        ctx.fillRect(x - bw / 2, Math.min(y(k.o), y(k.c)), bw, Math.max(1, Math.abs(y(k.c) - y(k.o))))
      }
      return true
    }

    let tries = 0
    let raf = 0
    function kick() {
      const ok = draw()
      if (!ok && tries++ < 24) raf = requestAnimationFrame(kick)
    }
    kick()
    const ro = new ResizeObserver(() => kick())
    ro.observe(box)
    window.addEventListener('orientationchange', kick)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('orientationchange', kick)
    }
  }, [candles, tf])

  return (
    <div className="chart-box relative" id="chartBox" ref={boxRef}>
      <canvas id="chart" ref={cnvRef} />
      {!candles.length ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-wide text-muted">
          {emptyHint}
        </p>
      ) : null}
    </div>
  )
}
