import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Animated SVG "beams" background (Aceternity UI's Background Beams
 * pattern): a fan of static curved paths, each stroked with a gradient
 * whose endpoints are animated — the stroke itself never moves, only the
 * gradient sweeping along it, which reads as light flowing through a wire.
 *
 * This is a from-scratch reimplementation of the technique, not a pasted
 * copy of Aceternity's exact hand-tuned path data (which this project
 * doesn't have a dependency on) — the beam paths below are generated
 * procedurally as a fan of diagonal S-curves, and the gradient stops are
 * rebuilt for this project's palette (lime/olive/black) instead of the
 * original's blue/purple.
 *
 * PERF: animating a linearGradient's x1/x2/y1/y2 is a paint-triggering
 * change, not a compositor-accelerated one like transform/opacity — every
 * one of these running concurrently repaints its stroked path every frame.
 * When this was scoped to just the Concept section that was cheap enough
 * to get away with; stretching it across Concept+Market+FAQ (this file's
 * rendered height going from ~800px to 2000px+) made the same per-frame
 * repaint cover a much bigger surface, which is what actually caused the
 * lag past Hero. Two fixes below: hard-pause via IntersectionObserver
 * (same pattern as the cosmos canvas) so it costs nothing while off-
 * screen, and a capped render height instead of stretching to whatever
 * the combined 3-section container happens to be.
 *
 * No shadcn/`cn`/lucide-react here — this project is plain Vite + React
 * + Tailwind (no shadcn, no TS path aliases), so this is a regular .jsx
 * component living alongside the rest of src/components, using a plain
 * template-literal className join instead of a `cn()` helper.
 */
const BEAM_COUNT = 10
const BEAM_SPAN = 1650 / (BEAM_COUNT - 1)

const paths = Array.from({ length: BEAM_COUNT }, (_, i) => {
  const x = -200 + i * BEAM_SPAN
  return `M${x} -100C${x} -100 ${x + 120} 380 ${x + 620} 620C${x + 1120} 860 ${x + 1200} 1400 ${x + 1200} 1400`
})

export function BackgroundBeams({ className = '' }) {
  const rootRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setActive(true) // no IO support — fail open rather than showing nothing
      return
    }
    // rootMargin gives it a head start so the beams are already animating
    // by the time they scroll into view, not popping in mid-animation.
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      rootMargin: '300px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Capped height, anchored to the top: covers Concept fully and well
          into Market rather than stretching (and re-rasterizing) across
          the entire, much taller, three-section span. */}
      <div className="absolute inset-x-0 top-0 flex h-[1500px] max-h-full items-start justify-center">
        {active && (
          <svg
            className="absolute h-full w-full"
            width="100%"
            height="100%"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            fill="none"
          >
            {paths.map((d, index) => (
              <motion.path
                key={`beam-path-${index}`}
                d={d}
                stroke={`url(#exomind-beam-gradient-${index})`}
                strokeOpacity="0.45"
                strokeWidth="1"
              />
            ))}
            <defs>
              {paths.map((_, index) => (
                <motion.linearGradient
                  id={`exomind-beam-gradient-${index}`}
                  key={`beam-gradient-${index}`}
                  initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
                  animate={{
                    x1: ['0%', '100%'],
                    x2: ['0%', '95%'],
                    y1: ['0%', '100%'],
                    y2: ['0%', `${93 + Math.random() * 8}%`],
                  }}
                  transition={{
                    duration: Math.random() * 10 + 10,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    delay: Math.random() * 10,
                  }}
                >
                  <stop stopColor="#ccff00" stopOpacity="0" />
                  <stop stopColor="#ccff00" />
                  <stop offset="32.5%" stopColor="#85a600" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </motion.linearGradient>
              ))}
            </defs>
          </svg>
        )}

        {/* Soft vignette so beams fade toward the edges of their own box
            instead of hard-cutting — aligned to the same capped box as the
            svg above so the fade and the cutoff line up. The original
            component uses an external noise-mask image for this; this is
            a dependency-free CSS equivalent for the same goal. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#000000_100%)] opacity-70" />
      </div>
    </div>
  )
}
