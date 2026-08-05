import { useEffect, useRef } from 'react'
import { useLenis } from '../lib/SmoothScroll'

function enterFullMap() {
  if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
  else window.__voidCosmosPendingEnter = true
}

function exitFullMap() {
  window.__voidCosmos?.exitArena?.()
}

/**
 * Full-bleed map arena. Galaxy stays in the hero as the demo by default —
 * only relocates here on explicit MAP / View full map, and returns when
 * you leave this section so page scroll stays usable.
 */
export function CosmosArena() {
  const lenisRef = useLenis()
  const sectionRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    // Only RETURN the demo to hero when the arena leaves view.
    // Do NOT auto-steal the galaxy on scroll — that emptied the hero
    // and trapped the wheel on a 100vh map.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) exitFullMap()
      },
      { threshold: 0.08 },
    )
    io.observe(el)

    if (location.hash === '#map') enterFullMap()

    return () => io.disconnect()
  }, [])

  function backToHero() {
    exitFullMap()
    lenisRef?.current?.scrollTo('#top', { offset: 0, duration: 1.15 })
  }

  function openHere() {
    enterFullMap()
  }

  return (
    <section id="map" className="cosmos-arena" ref={sectionRef}>
      <div className="arena-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p className="arena-ph-title">FULL VOID MAP</p>
          <p>Hero keeps the live demo. Open the deep map when you want to play.</p>
          <button type="button" className="btn-lime arena-ph-btn" onClick={openHere}>
            Drop galaxy here ↗
          </button>
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
          Click map to explore (wheel zooms) · otherwise page scrolls · shift+click stack · drag orbit
        </p>
      </div>
    </section>
  )
}
