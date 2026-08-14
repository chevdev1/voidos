import { useEffect, useRef, useState } from 'react'

/**
 * Cheap static veil — animated SVG beams were cooking phones next to the galaxy.
 */
export function BackgroundBeams({ className = '' }) {
  const rootRef = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    try {
      if (matchMedia('(max-width: 960px), (hover: none) and (pointer: coarse)').matches) return
    } catch {
      /* ignore */
    }
    setOn(true)
  }, [])

  if (!on) return null

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.04)_0%,transparent_55%)]" />
    </div>
  )
}
