import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CosmosPanel } from '../components/CosmosPanel'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import { BootSplash } from '../components/BootSplash'
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
 * is created once, already full-screen, in its one and only home.
 *
 * Cleanup deliberately does NOT call exitArena() — that function's job is
 * to appendChild the canvas back into #heroCosmosSlot, a "return the
 * shared canvas home" step that only makes sense for the old in-page
 * popup, where the same DOM node had to survive the trip back. This page's
 * canvas has no home to return to; it's disposed entirely on unmount.
 * Calling exitArena() here was the actual bug behind "an extra universe
 * appears back on the landing page": by the time that cleanup ran,
 * LandingPage had often already mounted its own fresh #heroCosmosSlot +
 * CosmosPanel, so exitArena() was appendChild-ing this page's dying canvas
 * *into* that brand-new tree — a duplicate, orphaned galaxy with clashing
 * ids that also left the new engine instance confused.
 */
export default function MapPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [booting, setBooting] = useState(true)

  function closeMap() {
    document.body.classList.remove('arena-live', 'term-open')
    navigate('/')
  }

  useEffect(() => {
    let destroy = null
    let cancelled = false
    window.__voidMapPainted = false

    // Fired by voidEngine.js's draw() the first time it actually paints a
    // frame with real (non-zero) dimensions — a more reliable "the map is
    // truly ready" signal than "the engine object exists", which could
    // still be true a frame or two before anything real is on screen.
    const onFrame = () => {
      if (!cancelled) {
        setReady(true)
        setBooting(false)
      }
    }
    const failSafe = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 16000)

    window.addEventListener('void-cosmos-frame', onFrame)

    ;(async () => {
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
      // #cosmosFrame is already inside #arenaStage in this page's own JSX
      // (unlike the old popup, nothing needs to be appendChild'd here), so
      // enterArena()'s relocation check just no-ops — this call is only
      // for its side effects: arenaMode = true (full-screen CSS + draw-
      // loop gates), body classes, and snapping to the home framing.
      window.__voidCosmos?.enterArena?.()
    })()

    return () => {
      cancelled = true
      clearTimeout(failSafe)
      window.removeEventListener('void-cosmos-frame', onFrame)
      document.body.classList.remove('arena-live')
      destroy?.()
    }
  }, [])

  return (
    <div id="map" className="void cosmos-map-pop open map-page" role="dialog" aria-label="Full void map">
      {booting && <BootSplash ready={ready} onDone={() => setBooting(false)} />}

      <button type="button" className="arena-close" onClick={closeMap}>
        ✕ close
      </button>

      <div className="arena-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p className="arena-ph-title">LOADING VOID…</p>
          <p>charting 200 lots</p>
        </div>
        <CosmosPanel />
      </div>

      <div className="arena-hud">
        <div className="arena-hud-top">
          <div>
            <div className="arena-title-row flex flex-row flex-wrap items-center gap-4">
              <Link
                to="/"
                className="arena-home shrink-0 whitespace-nowrap"
                aria-label="back to home"
              >
                <img src="/assets/void-logo.png" alt="" />
                VOID<em>.OS</em>
              </Link>
              <p className="arena-eyebrow whitespace-nowrap">FULL MAP</p>
            </div>
            <h2>
              Enter the <em>void</em>
            </h2>
          </div>
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
