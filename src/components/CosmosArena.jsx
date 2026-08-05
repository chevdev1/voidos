import { useEffect, useRef } from 'react'
import { useLenis } from '../lib/SmoothScroll'

function enterFullMap() {
  if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
  else window.__voidCosmosPendingEnter = true
}

/**
 * Mindless-style full-viewport void map. Galaxy auto-drops in when this
 * section is on screen (and via MAP / View full map).
 */
export function CosmosArena() {
  const lenisRef = useLenis()
  const sectionRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      enterFullMap()
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) enterFullMap()
      },
      { threshold: [0.15, 0.3, 0.5], rootMargin: '80px 0px' },
    )
    io.observe(el)

    if (location.hash === '#map') enterFullMap()

    return () => io.disconnect()
  }, [])

  function backToHero() {
    window.__voidCosmos?.exitArena?.()
    lenisRef?.current?.scrollTo('#top', { offset: 0, duration: 1.15 })
  }

  return (
    <section id="map" className="cosmos-arena" ref={sectionRef}>
      <div className="arena-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p>loading void feed…</p>
        </div>
      </div>

      <div className="arena-hud">
        <div className="arena-hud-top">
          <div>
            <p className="arena-eyebrow">SECTOR MAP · FULL FEED</p>
            <h2>
              Enter the <em>void</em>
            </h2>
          </div>
          <button type="button" className="arena-back" onClick={backToHero}>
            ← surface
          </button>
        </div>
        <p className="arena-lead">
          Micro → mega grains · shift+click stack · drag orbit · wheel zoom · click a grain to claim
        </p>
      </div>
    </section>
  )
}
