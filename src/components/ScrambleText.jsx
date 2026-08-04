import { useEffect, useRef, useState } from 'react'

const CHARS = '!<>-_\\/[]{}—=+*^?#0123456789'

/**
 * Reveals `text` by resolving random glyphs left-to-right, terminal-decrypt
 * style. `trigger="view"` fires once when the node enters the viewport;
 * `trigger="hover"` re-scrambles on every hover — used sparingly, per the
 * "tens of times a day = reduce" rule, so keep this off high-frequency nav.
 */
export function ScrambleText({ text, className = '', trigger = 'view', duration = 700, as: Tag = 'span' }) {
  const [display, setDisplay] = useState(trigger === 'view' ? text.replace(/\S/g, ' ') : text)
  const nodeRef = useRef(null)
  const frameRef = useRef(null)
  const playedRef = useRef(false)

  function play() {
    if (trigger === 'view' && playedRef.current) return
    playedRef.current = true
    cancelAnimationFrame(frameRef.current)
    const start = performance.now()

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration)
      const revealCount = Math.floor(progress * text.length)
      let out = ''
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') out += ' '
        else if (i < revealCount) out += text[i]
        else out += CHARS[Math.floor(Math.random() * CHARS.length)]
      }
      setDisplay(out)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else setDisplay(text)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (trigger !== 'view') return
    const el = nodeRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      play()
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play()
          io.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Tag ref={nodeRef} className={className} onMouseEnter={trigger === 'hover' ? play : undefined}>
      {display}
    </Tag>
  )
}
