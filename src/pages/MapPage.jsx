import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CosmosPanel } from '../components/CosmosPanel'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import '../legacy/void.css'
import '../legacy/phoneMap.css'

/**
 * Dedicated full-map route.
 *
 * The old flow ran the full map as an in-page popup: the *same* canvas +
 * engine instance got physically relocated (appendChild) out of the Hero
 * section's small demo slot into a full-screen overlay, then back again on
 * close. That "one engine, two homes" trick is what kept breaking:
 *  - the IntersectionObserver tracking the canvas's visibility didn't
 *    reliably re-fire for a target reparented out of a briefly-hidden
 *    ancestor (only minimizing/restoring the tab or a full reload forced
 *    a re-check — which is exactly what "fixed" it each time in testing),
 *  - the resize/draw-loop restart had its own ordering races across that
 *    same relocation,
 *  - it had to coordinate with the Hero teaser modal's pause state and
 *    the boot splash's z-index, neither of which have anything to do with
 *    the map itself.
 *
 * This route sidesteps all of that by not relocating anything: the canvas
 * is created once, already full-screen, in its one and only home. Same
 * engine code (initVoidEngine), same markup (CosmosPanel), just mounted
 * directly instead of teleported in from Hero.
 */
export default function MapPage() {
  useEffect(() => {
    let destroy = null
    let cancelled = false
    ;(async () => {
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
      // #cosmosFrame is already inside #arenaStage in this page's own JSX
      // (unlike the old popup, nothing needs to be appendChild'd here), so
      // enterArena()'s relocation check just no-ops — this call is only
      // for its side effects: arenaMode = true (which is what makes the
      // full-screen CSS and the draw-loop gates apply), body classes, and
      // snapping to the home framing.
      window.__voidCosmos?.enterArena?.()
    })()
    return () => {
      cancelled = true
      window.__voidCosmos?.exitArena?.()
      destroy?.()
    }
  }, [])

  return (
    <div id="map" className="void cosmos-map-pop open" role="dialog" aria-label="Full void map">
      <div className="arena-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p className="arena-ph-title">LOADING VOID…</p>
        </div>
        <CosmosPanel />
      </div>

      <div className="arena-hud">
        <div className="arena-hud-top">
          <Link to="/" className="arena-home" aria-label="back to home">
            <img src="/assets/void-logo.png" alt="" />
            VOID<em>.OS</em>
          </Link>
          <Link to="/" className="arena-back" aria-label="close map">
            ✕ close
          </Link>
        </div>
        <p className="arena-lead">
          Tap constellations to buy — stack as many as you want · each glows alone · claim all at
          once
        </p>
      </div>

      <SectorTerminal />
      <MindChat />
    </div>
  )
}
