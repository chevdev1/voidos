import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'
import { MagneticButton } from './MagneticButton'
import { CosmosPanel } from './CosmosPanel'
import '../legacy/void.css'
import '../legacy/phoneMap.css'

const EASE_OUT = [0.23, 1, 0.32, 1]
const CA = String(
  import.meta.env.VITE_EXO_CA || import.meta.env.VITE_EXO_TOKEN || import.meta.env.VITE_EXO_MINT || '',
).trim()
const X_URL = String(import.meta.env.VITE_X_URL || '').trim()
const TG_URL = String(import.meta.env.VITE_TELEGRAM_URL || '').trim()
const caLive = Boolean(CA)

export function Hero() {
  const lenisRef = useLenis()
  const [copied, setCopied] = useState(false)

  function goTo(target) {
    lenisRef?.current?.scrollTo(target, { offset: -20, duration: 1.4 })
  }

  function copyCA() {
    if (!caLive) return
    navigator.clipboard?.writeText(CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
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
          A digital void for the next-gen OS. One autonomous AI probe — mind split across 50,000
          sectors in 500 systems. Zoom the cosmos. Hover a cluster. Claim the pull.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.32 }}
          className="ca-row"
        >
          <div className="ca-box" id="ca" title={caLive ? CA : 'Contract / mint not live yet'}>
            {caLive ? CA : 'CA TBA · mint not live'}
          </div>
          <motion.button
            whileTap={{ scale: caLive ? 0.94 : 1 }}
            className="ca-copy"
            onClick={copyCA}
            disabled={!caLive}
            aria-label={caLive ? 'copy contract address' : 'contract not available yet'}
          >
            {caLive ? (copied ? '✓' : '⧉') : '—'}
          </motion.button>
        </motion.div>

        {(X_URL || TG_URL) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.36 }}
            className="mt-3 flex flex-wrap gap-2"
          >
            {X_URL ? (
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Follow
              </a>
            ) : null}
            {TG_URL ? (
              <a
                href={TG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Telegram
              </a>
            ) : null}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.42 }}
          className="cta"
        >
          <a
            className="btn-lime"
            href="#market"
            onClick={(e) => {
              e.preventDefault()
              goTo('#market')
            }}
          >
            Claim a sector ↗
          </a>

          <MagneticButton
            onClick={() => goTo('#concept')}
            className="rounded-full bg-lime px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_0_0_rgba(204,255,0,0)] transition-shadow duration-300 ease-out hover:shadow-[0_0_28px_rgba(204,255,0,0.5)]"
          >
            What is this?
          </MagneticButton>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
              else if (window.__openFullMap) window.__openFullMap()
              else window.__voidCosmosPendingEnter = true
            }}
          >
            Open full map
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="price-note"
        >
          Sectors are scattered organic clusters — not a grid.{' '}
          <b>Closer to a galaxy core = more expensive.</b> Outer rim is cheap fuel for wild signals.
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
        <div className="hero-map-actions" aria-label="map actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => document.getElementById('cosmosExploreBtn')?.click()}
          >
            Explore map
          </button>
          <button
            type="button"
            className="btn-lime"
            onClick={() => {
              if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
              else if (window.__openFullMap) window.__openFullMap()
              else window.__voidCosmosPendingEnter = true
            }}
          >
            Open full map
          </button>
          <button type="button" className="btn-ghost" onClick={() => window.__openMindChat?.()}>
            Ask the mind
          </button>
        </div>
      </motion.div>
    </section>
  )
}
