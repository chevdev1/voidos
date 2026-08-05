import { motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'

const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * Full-bleed map arena — the live cosmos panel relocates here when the
 * user hits "View full map". Mindless-style deep zoom / multi-claim lives here.
 */
export function CosmosArena() {
  const lenisRef = useLenis()

  function backToHero() {
    window.__voidCosmos?.exitArena?.()
    lenisRef?.current?.scrollTo('#top', { offset: 0, duration: 1.2 })
  }

  return (
    <section id="map" className="cosmos-arena">
      <div className="arena-chrome">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
          className="arena-copy"
        >
          <p className="arena-eyebrow">SECTOR MAP · FULL FEED</p>
          <h2>
            Enter the <em>void</em>
          </h2>
          <p className="arena-lead">
            Grains come in micro → mega sizes. Shift+click to stack several, then claim the bundle in
            one burn. Drag to orbit. Wheel to zoom. This is the deep map.
          </p>
          <button type="button" className="arena-back" onClick={backToHero}>
            ← back to surface
          </button>
        </motion.div>
      </div>

      <div className="arena-stage" id="arenaStage">
        {/* cosmosFrame relocates here from #heroCosmosSlot */}
        <div className="arena-placeholder" id="arenaPlaceholder">
          <p>Open the full map from the hero to drop the live galaxy here.</p>
        </div>
      </div>
    </section>
  )
}
