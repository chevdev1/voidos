import { useEffect } from 'react'
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
import { initVoidEngine } from '../legacy/voidEngine'

export default function LandingPage() {
  useEffect(() => {
    let destroy = null
    let cancelled = false
    const start = () => {
      if (cancelled) return
      destroy = initVoidEngine()
    }
    let idleId = null
    let timeoutId = null
    if (typeof requestIdleCallback !== 'undefined') {
      idleId = requestIdleCallback(start, { timeout: 400 })
    } else {
      timeoutId = setTimeout(start, 50)
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
      <CosmosArena />

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

      <SectorTerminal />
    </SmoothScrollProvider>
  )
}
