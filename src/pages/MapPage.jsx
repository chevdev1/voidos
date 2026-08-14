import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CosmosPanel } from '../components/CosmosPanel'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import '../legacy/void.css'
import '../legacy/phoneMap.css'

/** Full map is its own page — not a popup over the landing nav. */
export default function MapPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  function goHome() {
    document.body.classList.remove('arena-live')
    navigate('/')
  }

  useEffect(() => {
    let destroy = null
    let cancelled = false
    window.__voidMapPainted = false

    const onFrame = () => {
      if (!cancelled) setLoading(false)
    }
    const failSafe = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 12000)

    window.addEventListener('void-cosmos-frame', onFrame)

    ;(async () => {
      const { initVoidEngine } = await import('../legacy/voidEngine')
      if (cancelled) return
      destroy = initVoidEngine()
    })()

    return () => {
      cancelled = true
      clearTimeout(failSafe)
      window.removeEventListener('void-cosmos-frame', onFrame)
      document.body.classList.remove('arena-live')
      destroy?.()
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') goHome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div id="mapRoute" className="map-route">
      <header className="map-top">
        <button type="button" className="map-home" onClick={goHome}>
          <img src="/assets/void-logo.png" alt="" />
          VOID<em>.OS</em>
        </button>
        <span className="map-top-title">full map</span>
        <button type="button" className="map-close" onClick={goHome}>
          ✕ close
        </button>
      </header>

      {loading && (
        <div className="map-load" aria-live="polite">
          <p className="arena-ph-title">LOADING VOID…</p>
          <p>charting lots — this can take a few seconds</p>
        </div>
      )}

      <div className="map-stage" id="arenaStage">
        <div className="arena-placeholder" id="arenaPlaceholder" hidden>
          <p className="arena-ph-title">LOADING VOID…</p>
        </div>
        <CosmosPanel />
      </div>

      <SectorTerminal />
      <MindChat />
    </div>
  )
}
