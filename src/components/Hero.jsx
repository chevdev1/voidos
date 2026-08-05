import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'
import { MagneticButton } from './MagneticButton'
import { ScrambleText } from './ScrambleText'
import { CosmosPanel } from './CosmosPanel'
import '../legacy/void.css'

const EASE_OUT = [0.23, 1, 0.32, 1]
const CA = '0xEXO…VOID0000000000000000000DEAD'

export function Hero() {
  const lenisRef = useLenis()
  const [copied, setCopied] = useState(false)

  function goTo(target) {
    lenisRef?.current?.scrollTo(target, { offset: -20, duration: 1.4 })
  }

  function copyCA() {
    navigator.clipboard?.writeText(CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
  }

  function openFullMap() {
    if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
    else window.__voidCosmosPendingEnter = true
    goTo('#map')
  }

  return (
    <section className="void hero" id="top">
      <div className="hero-left">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="live"
        >
          <i /> Live probe · ExoMind online
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
        >
          VOID<em>.OS</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.22 }}
          className="lead"
        >
          A digital void for the next-gen OS. One autonomous AI probe — mind split across sectors of
          different mass. Micro grains. Mega cores. Stack several. Burn once.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.32 }}
          className="ca-row"
        >
          <div className="ca-box" id="ca">
            {CA}
          </div>
          <motion.button whileTap={{ scale: 0.94 }} className="ca-copy" onClick={copyCA}>
            {copied ? '✓' : '⧉'}
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.42 }}
          className="cta"
        >
          <button type="button" className="btn-lime" onClick={openFullMap}>
            View full map ↗
          </button>

          <MagneticButton
            onClick={() => goTo('#concept')}
            className="rounded-full bg-lime px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_0_0_rgba(204,255,0,0)] transition-shadow duration-300 ease-out hover:shadow-[0_0_28px_rgba(204,255,0,0.5)]"
          >
            What is this?
          </MagneticButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="price-note"
        >
          Closer to a galaxy core = more expensive. Grain <b>size</b> stacks on top — megas cost more
          cells to claim. Shift+click to build a stack.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25 }}
        className="hero-cosmos-slot"
        id="heroCosmosSlot"
      >
        <CosmosPanel />
        <button type="button" className="hero-map-open" onClick={openFullMap}>
          Open full map
        </button>
      </motion.div>

      <div className="scroll-cue">
        <ScrambleText text="SCROLL FOR LORE" trigger="view" />
        <i />
      </div>
    </section>
  )
}
