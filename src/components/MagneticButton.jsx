import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

const PULL_SPRING = { stiffness: 150, damping: 15, mass: 0.15 }
const LABEL_SPRING = { stiffness: 150, damping: 16, mass: 0.1 }

/**
 * Magnetic CTA: the button (and, at reduced strength, its label) glide toward
 * the cursor within a radius, then spring back on leave. Motion is expressed
 * purely as `transform`, so it stays off the main thread under load.
 */
export function MagneticButton({
  children,
  className = '',
  strength = 0.35,
  labelStrength = 0.5,
  onClick,
  as: Component = motion.button,
  ...props
}) {
  const ref = useRef(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, PULL_SPRING)
  const springY = useSpring(y, PULL_SPRING)

  const labelX = useMotionValue(0)
  const labelY = useMotionValue(0)
  const labelSpringX = useSpring(labelX, LABEL_SPRING)
  const labelSpringY = useSpring(labelY, LABEL_SPRING)

  function handleMouseMove(e) {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    x.set(relX * strength)
    y.set(relY * strength)
    labelX.set(relX * labelStrength * strength)
    labelY.set(relY * labelStrength * strength)
  }

  function reset() {
    x.set(0)
    y.set(0)
    labelX.set(0)
    labelY.set(0)
  }

  return (
    <Component
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      onClick={onClick}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.96 }}
      className={`group relative isolate ${className}`}
      {...props}
    >
      <span className="absolute -inset-3 -z-10 rounded-full bg-lime/0 blur-xl transition-colors duration-300 ease-out group-hover:bg-lime/30" />
      <motion.span style={{ x: labelSpringX, y: labelSpringY }} className="relative flex items-center gap-2">
        {children}
      </motion.span>
    </Component>
  )
}
