import { useEffect } from 'react'
import { SmoothScrollProvider } from './lib/SmoothScroll'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { ConceptSection } from './components/ConceptSection'
import { MarketSection } from './components/MarketSection'
import { FAQSection } from './components/FAQSection'
import { BackgroundBeams } from './components/BackgroundBeams'
import { Footer } from './components/Footer'
import { SectorTerminal } from './components/SectorTerminal'
import { initVoidEngine } from './legacy/voidEngine'

export default function App() {
  useEffect(() => {
    const destroy = initVoidEngine()
    return destroy
  }, [])

  return (
    <SmoothScrollProvider>
      <Nav />

      {/* Full-bleed: the cosmos canvas is meant to fill the viewport edge to edge */}
      <Hero />

      {/* One continuous beams background behind Concept + Market + FAQ,
          instead of a separate instance per section — the effect flows
          across the whole span with no seam at section boundaries, and
          it's a single SVG animation instead of three. */}
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
