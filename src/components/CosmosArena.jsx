import { useEffect } from 'react'

function openMapPop() {
  if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
  else window.__voidCosmosPendingEnter = true
}

function closeMapPop() {
  window.__voidCosmos?.exitArena?.()
}

/**
 * Full-map popup — same live cosmos engine relocates here with filters,
 * orbit, zoom, claim terminal + stack cart. Hero keeps the demo underneath.
 */
export function CosmosArena() {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeMapPop()
    }
    window.addEventListener('keydown', onKey)

    // Expose React-side open for buttons that fire before engine mounts
    window.__openFullMap = openMapPop
    window.__closeFullMap = closeMapPop

    if (location.hash === '#map') openMapPop()

    return () => {
      window.removeEventListener('keydown', onKey)
      delete window.__openFullMap
      delete window.__closeFullMap
    }
  }, [])

  return (
    <div
      id="map"
      className="cosmos-map-pop"
      role="dialog"
      aria-modal="true"
      aria-label="Full void map"
      hidden
    >
      <div className="arena-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p className="arena-ph-title">LOADING VOID…</p>
        </div>
      </div>

      <div className="arena-hud">
        <div className="arena-hud-top">
          <div>
            <p className="arena-eyebrow">FULL MAP · POP</p>
            <h2>
              Enter the <em>void</em>
            </h2>
          </div>
          <button type="button" className="arena-back" id="mapPopClose" onClick={closeMapPop}>
            ✕ close
          </button>
        </div>
        <p className="arena-lead">
          Drag orbit · wheel / pinch zoom · tap grain to claim · shift+click stack · filters &amp;
          minimap live
        </p>
      </div>
    </div>
  )
}
