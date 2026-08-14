import { useEffect, useRef } from 'react'

/**
 * VOID candle canvas — thin bodies, volume, last-print tag.
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

      const padL = 8
      const padR = 56
      const padT = 14
      const volH = 36
      const padB = 8
      const plotH = H - padT - volH - padB
      const plotW = W - padL - padR

      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, 'rgba(204,255,0,0.04)')
      g.addColorStop(0.55, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)

      if (!candles.length) return true

      let lo = Infinity
      let hi = -Infinity
      let vmax = 0
      for (const k of candles) {
        lo = Math.min(lo, k.l)
        hi = Math.max(hi, k.h)
        vmax = Math.max(vmax, k.v || 0)
      }
      const span = hi - lo || Math.max(Math.abs(hi) * 0.04, 1e-12)
      lo -= span * 0.08
      hi += span * 0.1
      const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH

      ctx.strokeStyle = 'rgba(204,255,0,0.07)'
      ctx.lineWidth = 1
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace'
      for (let i = 0; i < 5; i++) {
        const t = i / 4
        const gy = padT + plotH * t
        const pv = hi - (hi - lo) * t
        ctx.beginPath()
        ctx.moveTo(padL, gy)
        ctx.lineTo(W - padR + 6, gy)
        ctx.stroke()
        ctx.fillStyle = 'rgba(154,154,162,0.7)'
        ctx.textAlign = 'left'
        ctx.fillText(fmtAxis(pv), W - padR + 10, gy + 3)
      }

      const last = candles.at(-1)
      const lastY = y(last.c)
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = 'rgba(204,255,0,0.28)'
      ctx.beginPath()
      ctx.moveTo(padL, lastY)
      ctx.lineTo(W - padR, lastY)
      ctx.stroke()
      ctx.setLineDash([])

      const n = candles.length
      const slot = plotW / Math.max(n, 1)
      const bw = Math.min(9, Math.max(2.5, slot * 0.46))

      if (n >= 2) {
        ctx.beginPath()
        candles.forEach((k, i) => {
          const x = padL + i * slot + slot / 2
          if (i === 0) ctx.moveTo(x, y(k.c))
          else ctx.lineTo(x, y(k.c))
        })
        const lx = padL + (n - 1) * slot + slot / 2
        ctx.lineTo(lx, padT + plotH)
        ctx.lineTo(padL + slot / 2, padT + plotH)
        ctx.closePath()
        const area = ctx.createLinearGradient(0, padT, 0, padT + plotH)
        area.addColorStop(0, 'rgba(204,255,0,0.12)')
        area.addColorStop(1, 'rgba(204,255,0,0)')
        ctx.fillStyle = area
        ctx.fill()

        ctx.beginPath()
        candles.forEach((k, i) => {
          const x = padL + i * slot + slot / 2
          if (i === 0) ctx.moveTo(x, y(k.c))
          else ctx.lineTo(x, y(k.c))
        })
        ctx.strokeStyle = 'rgba(204,255,0,0.28)'
        ctx.lineWidth = 1.25
        ctx.stroke()
      }

      for (let i = 0; i < n; i++) {
        const k = candles[i]
        const x = padL + i * slot + slot / 2
        const up = k.c >= k.o
        const col = up ? '#ccff00' : '#ff5a6a'
        const lastC = i === n - 1
        ctx.strokeStyle = col
        ctx.lineWidth = lastC ? 1.4 : 1
        ctx.beginPath()
        ctx.moveTo(x, y(k.h))
        ctx.lineTo(x, y(k.l))
        ctx.stroke()
        const top = Math.min(y(k.o), y(k.c))
        const bh = Math.max(1.5, Math.abs(y(k.c) - y(k.o)))
        ctx.fillStyle = col
        if (lastC) {
          ctx.shadowColor = col
          ctx.shadowBlur = 10
        }
        ctx.fillRect(x - bw / 2, top, bw, bh)
        ctx.shadowBlur = 0

        if (vmax > 0) {
          const vh = Math.max(2, ((k.v || 0) / vmax) * (volH - 10))
          ctx.globalAlpha = lastC ? 0.55 : 0.28
          ctx.fillRect(x - bw / 2, H - padB - vh, bw, vh)
          ctx.globalAlpha = 1
        }
      }

      const tag = fmtAxis(last.c)
      ctx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace'
      const tw = ctx.measureText(tag).width + 10
      const ty = Math.min(H - volH - 8, Math.max(padT + 8, lastY))
      ctx.fillStyle = '#ccff00'
      ctx.fillRect(W - padR + 8, ty - 8, tw, 16)
      ctx.fillStyle = '#050505'
      ctx.textAlign = 'left'
      ctx.fillText(tag, W - padR + 13, ty + 3)

      ctx.fillStyle = 'rgba(154,154,162,0.55)'
      ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace'
      ctx.fillText(tf || '', padL, H - 4)
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

function fmtAxis(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.01) return v.toFixed(5)
  const s = v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  return s
}
