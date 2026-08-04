import { useEffect } from 'react'
import { SmoothScrollProvider } from './lib/SmoothScroll'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { ConceptSection } from './components/ConceptSection'
import { MarketSection } from './components/MarketSection'
import { FAQSection } from './components/FAQSection'
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

      <main className="relative mx-auto max-w-6xl">
        <ConceptSection />
        <MarketSection />
        <FAQSection />
      </main>

      <div className="mx-auto max-w-6xl">
        <Footer />
      </div>

      <SectorTerminal />
    </SmoothScrollProvider>
  )
}
