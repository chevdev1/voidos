import { createContext, useContext, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { frame, cancelFrame } from 'framer-motion'

const LenisContext = createContext(null)

function isMobileScroll() {
  try {
    return window.matchMedia('(max-width: 960px), (hover: none) and (pointer: coarse)').matches
  } catch {
    return false
  }
}

function nativeScrollTo(target, { offset = 0 } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY + offset
  window.scrollTo({ top, behavior: 'smooth' })
}

function eventOverActiveCosmos(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue
    if (node.id === 'cosmosFrame' && node.dataset.mapActive === '1') return true
  }
  const el = event.target
  if (el instanceof Element) {
    const cosmos = el.closest?.('#cosmosFrame')
    if (cosmos?.dataset?.mapActive === '1') return true
  }
  return false
}

/**
 * Desktop: Lenis smooth scroll.
 * Phone: native scroll only — Lenis + touch on a full-bleed canvas was
 * making the whole site unusable.
 */
export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null)

  useEffect(() => {
    const shim = {
      scrollTo: nativeScrollTo,
      start() {},
      stop() {},
      destroy() {},
      raf() {},
    }

    if (isMobileScroll()) {
      lenisRef.current = shim
      document.documentElement.classList.add('native-scroll')
      return () => {
        document.documentElement.classList.remove('native-scroll')
        lenisRef.current = null
      }
    }

    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.1,
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
