import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CosmosPanel } from '../components/CosmosPanel'
import { SectorTerminal } from '../components/SectorTerminal'
import { MindChat } from '../components/MindChat'
import { BootSplash } from '../components/BootSplash'
import '../legacy/void.css'
import '../legacy/phoneMap.css'

export default function MapPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [booting, setBooting] = useState(true)

  function closeMap() {
    document.body.classList.remove('arena-live')
    navigate('/')
  }

  useEffect(() => {
    let destroy = null
    let cancelled = false
    window.__voidMapPainted = false

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
          <p className="arena-eyebrow">FULL MAP</p>
          <h2>
            Enter the <em>void</em>
          </h2>
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
