import { useCallback, useEffect, useState } from 'react'
import { SmoothScrollProvider } from '../lib/SmoothScroll'
import { Nav } from '../components/Nav'
import { Hero } from '../components/Hero'
import { CosmosArena } from '../components/CosmosArena'
import { ConceptSection } from '../components/ConceptSection'
import { MarketSection } from '../components/MarketSection'
import { FAQSection } from '../components/FAQSection'
import { BackgroundBeams } from '../components/BackgroundBeams'
import { Footer } from '../components/Footer'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import { BootSplash } from '../components/BootSplash'
import { mindSession } from '../lib/mindClient'

export default function LandingPage() {
  const [booting, setBooting] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    mindSession().catch(() => {})
  }, [])

  useEffect(() => {
    let destroy = null
    let cancelled = false
    const failSafe = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 8000)

    const onReady = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true)
        })
      })
    }

    // The boot splash is a z-[400000] overlay above everything, including
    // the full-map popup — if the map gets opened while it's still up
    // (URL #map hash on cold load, an early click, the pending-enter
    // replay once the engine mounts), the map was rendering correctly
    // *underneath* a splash that takes 2 rAFs + a 520ms fade to actually
    // clear: "black screen" over a live, clickable map. Skip both the
    // ready delay and the splash's own exit fade the instant the map is
    // asked for — voidEngine.js's enterArena() fires this unconditionally.
    const onMapOpened = () => {
      if (cancelled) return
      setReady(true)
      setBooting(false)
    }

    const start = async () => {
      if (cancelled) return
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
      if (window.__voidCosmos) onReady()
    }

    window.addEventListener('void-cosmos-ready', onReady)
    window.addEventListener('void-map-opened', onMapOpened)
    start()

    return () => {
      cancelled = true
      clearTimeout(failSafe)
      window.removeEventListener('void-cosmos-ready', onReady)
      window.removeEventListener('void-map-opened', onMapOpened)
      destroy?.()
    }
  }, [])

  const finishBoot = useCallback(() => setBooting(false), [])

  return (
    <SmoothScrollProvider>
      {booting && <BootSplash ready={ready} onDone={finishBoot} />}
      <Nav />
      <Hero />
      <div className="relative overflow-hidden bg-void">
        <BackgroundBeams />
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
