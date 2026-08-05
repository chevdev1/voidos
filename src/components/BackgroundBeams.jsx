import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Animated SVG "beams" background (Aceternity-style): curved paths stroked
 * with animated gradients. Paint-costly — keep count low, pause off-screen
 * and when the tab is hidden.
 */
const BEAM_COUNT = 5
const BEAM_SPAN = 1650 / Math.max(1, BEAM_COUNT - 1)

const paths = Array.from({ length: BEAM_COUNT }, (_, i) => {
  const x = -200 + i * BEAM_SPAN
  return `M${x} -100C${x} -100 ${x + 120} 380 ${x + 620} 620C${x + 1120} 860 ${x + 1200} 1400 ${x + 1200} 1400`
})

export function BackgroundBeams({ className = '' }) {
  const rootRef = useRef(null)
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  )
  const active = inView && pageVisible

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '300px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute inset-x-0 top-0 flex h-[1200px] max-h-full items-start justify-center">
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
                strokeOpacity="0.4"
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
                    y2: ['0%', `${93 + ((index * 17) % 8)}%`],
                  }}
                  transition={{
                    duration: 12 + index * 1.4,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    delay: index * 0.7,
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

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#000000_100%)] opacity-70" />
      </div>
    </div>
  )
}
