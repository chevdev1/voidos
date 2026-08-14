import { useCallback, useEffect, useState } from 'react'
import { SmoothScrollProvider } from '../lib/SmoothScroll'
import { Nav } from '../components/Nav'
import { Hero } from '../components/Hero'
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
    }, 14000)

    const onReady = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true)
        })
      })
    }

    const start = async () => {
      if (cancelled) return
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
      if (window.__voidCosmos) onReady()
    }

    window.addEventListener('void-cosmos-ready', onReady)
    start()

    return () => {
      cancelled = true
      clearTimeout(failSafe)
      window.removeEventListener('void-cosmos-ready', onReady)
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
      <SectorTerminal />
      <MindChat />
    </SmoothScrollProvider>
  )
}
