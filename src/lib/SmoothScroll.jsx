import { createContext, useContext, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { frame, cancelFrame } from 'framer-motion'

const LenisContext = createContext(null)

/** True only while the galaxy is in "explore" mode (clicked), not on mere hover. */
function eventOverActiveCosmos(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue
    if (node.id === 'cosmosFrame' && node.dataset.mapActive === '1') return true
  }
  const el = event.target
  if (el instanceof Element) {
    const frame = el.closest?.('#cosmosFrame')
    if (frame?.dataset?.mapActive === '1') return true
  }
  return false
}

/**
 * Drives Lenis off Framer Motion's own frame loop instead of a second
 * requestAnimationFrame, so scroll-linked motion values never fall a frame
 * behind the smoothed scroll position.
 */
export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.1,
      // Only steal the wheel while the map is actively exploring — hover alone
      // must not block page scroll (hero is huge on most screens).
      prevent: (node) =>
        node.id === 'cosmosFrame' && node.dataset?.mapActive === '1',
      virtualScroll: (data) => {
        if (!eventOverActiveCosmos(data.event)) return
        if (data.event.cancelable) data.event.preventDefault()
        return false
      },
    })
    lenisRef.current = lenis

    function update(data) {
      lenis.raf(data.timestamp)
    }

    frame.update(update, true)

    return () => {
      cancelFrame(update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
}

export function useLenis() {
  return useContext(LenisContext)
}
