import { createContext, useContext, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { frame, cancelFrame } from 'framer-motion'

const LenisContext = createContext(null)

function eventOverCosmos(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue
    if (node.id === 'cosmosFrame' || node.id === 'cosmos') return true
    if (node.hasAttribute?.('data-lenis-prevent-wheel')) return true
  }
  // Fallback when composedPath is thin (some browsers / extensions)
  const el = event.target
  if (el instanceof Element && el.closest?.('#cosmosFrame')) return true
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
      // When true, Lenis skips — but does NOT preventDefault. Pair with
      // virtualScroll below so the page can't natively scroll over the map.
      prevent: (node) =>
        !!node.closest?.('#cosmosFrame') || node.hasAttribute?.('data-lenis-prevent-wheel'),
      virtualScroll: (data) => {
        if (!eventOverCosmos(data.event)) return
        // Block both Lenis smoothing AND native document scroll.
        if (data.event.cancelable) data.event.preventDefault()
        data.event.stopPropagation?.()
        return false
      },
    })
    lenisRef.current = lenis

    function update(data) {
      lenis.raf(data.timestamp)
    }

    frame.update(update, true)

    // Hard lock: while the pointer is over the galaxy, Lenis is stopped so
    // its own path also preventDefault's every wheel (see Lenis isStopped).
    function onEnter() {
      lenis.stop()
    }
    function onLeave() {
      lenis.start()
    }
    function bindFrame() {
      const el = document.getElementById('cosmosFrame')
      if (!el) return null
      el.addEventListener('pointerenter', onEnter)
      el.addEventListener('pointerleave', onLeave)
      return el
    }
    let frameEl = bindFrame()
    const obs = new MutationObserver(() => {
      if (!frameEl) frameEl = bindFrame()
    })
    obs.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelFrame(update)
      obs.disconnect()
      frameEl?.removeEventListener('pointerenter', onEnter)
      frameEl?.removeEventListener('pointerleave', onLeave)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
}

export function useLenis() {
  return useContext(LenisContext)
}
