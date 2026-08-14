import { lazy, Suspense, useEffect, useState } from 'react'
import { SmoothScrollProvider } from '../lib/SmoothScroll'
import { Nav } from '../components/Nav'
import { Hero } from '../components/Hero'
import { CosmosArena } from '../components/CosmosArena'
import { ConceptSection } from '../components/ConceptSection'
import { MarketSection } from '../components/MarketSection'
import { FAQSection } from '../components/FAQSection'
import { Footer } from '../components/Footer'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import { mindSession } from '../lib/mindClient'

const BackgroundBeams = lazy(() =>
  import('../components/BackgroundBeams').then((m) => ({ default: m.BackgroundBeams })),
)

function shouldSkipBeams() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    if (window.matchMedia('(max-width: 960px), (hover: none) and (pointer: coarse)').matches)
      return true
    if (navigator.connection?.saveData) return true
    if (navigator.deviceMemory != null && navigator.deviceMemory <= 4) return true
  } catch {
    /* ignore */
  }
  return false
}

export default function LandingPage() {
  const [showBeams, setShowBeams] = useState(false)

  useEffect(() => {
    mindSession().catch(() => {})
  }, [])

  useEffect(() => {
    if (shouldSkipBeams()) return
    let idleId = null
    let timeoutId = null
    const start = () => setShowBeams(true)
    if (typeof requestIdleCallback !== 'undefined') {
      idleId = requestIdleCallback(start, { timeout: 2500 })
    } else {
      timeoutId = setTimeout(start, 1800)
    }
    return () => {
      if (idleId != null && typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(idleId)
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    let destroy = null
    let cancelled = false
    const start = async () => {
      if (cancelled) return
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
    }
    let idleId = null
    let timeoutId = null
    const delay = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 900 : 450
    if (typeof requestIdleCallback !== 'undefined') {
      idleId = requestIdleCallback(start, { timeout: delay })
    } else {
      timeoutId = setTimeout(start, delay)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(idleId)
      if (timeoutId != null) clearTimeout(timeoutId)
      destroy?.()
    }
  }, [])

  return (
    <SmoothScrollProvider>
      <Nav />

      <Hero />

      <div className="relative overflow-hidden bg-void">
        {showBeams ? (
          <Suspense fallback={null}>
            <BackgroundBeams />
          </Suspense>
        ) : null}
        <main className="relative z-10 mx-auto max-w-6xl">
          <ConceptSection />
          <MarketSection />
          <FAQSection />
        </main>
      </div>

      <div className="mx-auto max-w-6xl">
        <Footer />
      </div>

      <CosmosArena />
      <SectorTerminal />
      <MindChat />
    </SmoothScrollProvider>
  )
}
