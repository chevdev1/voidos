import { createContext, useContext, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { frame, cancelFrame } from 'framer-motion'

const LenisContext = createContext(null)

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
