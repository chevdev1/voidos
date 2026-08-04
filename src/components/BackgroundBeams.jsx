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
 * No shadcn/`cn`/lucide-react here — this project is plain Vite + React
 * + Tailwind (no shadcn, no TS path aliases), so this is a regular .jsx
 * component living alongside the rest of src/components, using a plain
 * template-literal className join instead of a `cn()` helper.
 */
const BEAM_COUNT = 16

const paths = Array.from({ length: BEAM_COUNT }, (_, i) => {
  const x = -200 + i * 110
  return `M${x} -100C${x} -100 ${x + 120} 380 ${x + 620} 620C${x + 1120} 860 ${x + 1200} 1400 ${x + 1200} 1400`
})

export function BackgroundBeams({ className = '' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
    >
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

      {/* Soft vignette so beams fade toward the section edges instead of
          hard-cutting at the container bounds — the original component
          uses an external noise-mask image for this; this is a dependency-
          free CSS equivalent for the same "fade at the edges" goal. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#000000_100%)] opacity-70" />
    </div>
  )
}
