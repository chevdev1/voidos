import { useEffect, useRef } from 'react'

/**
 * VOID-styled candle canvas — lime up / red down, no third-party chart chrome.
 */
export function VoidChart({ candles = [], emptyHint = 'no prints yet' }) {
  const boxRef = useRef(null)
  const cnvRef = useRef(null)

  useEffect(() => {
    const box = boxRef.current
    const cnv = cnvRef.current
    if (!box || !cnv) return
    const ctx = cnv.getContext('2d')
    if (!ctx) return

    function draw() {
      const W = box.clientWidth
      const H = box.clientHeight
      if (!W || !H) return
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

      if (!candles.length) return

      let lo = Infinity
      let hi = -Infinity
      for (const k of candles) {
        lo = Math.min(lo, k.l)
        hi = Math.max(hi, k.h)
      }
      const span = hi - lo || Math.max(hi * 0.02, 1e-12)
      lo -= span * 0.08
      hi += span * 0.08
      const n = Math.max(candles.length, 8)
      const slot = W / n
      const bw = Math.max(2, slot * 0.55)
      const pad = Math.max(0, n - candles.length)
      const y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * (H - 28)

      for (let i = 0; i < candles.length; i++) {
        const k = candles[i]
        const x = (i + pad) * slot + slot / 2
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
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box)
    return () => ro.disconnect()
  }, [candles])

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
