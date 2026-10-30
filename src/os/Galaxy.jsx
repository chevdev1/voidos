import { useEffect } from 'react'
import { CosmosPanel } from '../components/CosmosPanel'
import { SectorTerminal } from '../components/SectorTerminal'

// The same galaxy as the landing hero, used as the desktop wallpaper.
// One engine instance, mounted once. Orbit, zoom, search and grain clicks all work.
export function Galaxy() {
  useEffect(() => {
    let destroy = null
    let cancelled = false
    ;(async () => {
      try {
        const { initVoidEngine } = await import('../legacy/voidEngine')
        if (cancelled) return
        destroy = initVoidEngine()
        window.__voidCosmos?.enterArena?.()
      } catch (err) {
        console.error('[void-os] galaxy failed to start', err)
      }
    })()
    return () => {
      cancelled = true
      document.body.classList.remove('arena-live')
      destroy?.()
    }
  }, [])

  return (
    <div className="os-galaxy void">
      <div className="arena-stage" id="arenaStage">
        <CosmosPanel />
      </div>
      <SectorTerminal />
    </div>
  )
}
