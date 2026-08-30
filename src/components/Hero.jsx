import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'
import { MagneticButton } from './MagneticButton'
import { CosmosPanel } from './CosmosPanel'
import { DEFAULT_EXO_TOKEN } from '../../shared/rhChain.js'
import '../legacy/void.css'
import '../legacy/phoneMap.css'

const EASE_OUT = [0.23, 1, 0.32, 1]
const CA = String(
  import.meta.env.VITE_EXO_CA ||
    import.meta.env.VITE_EXO_TOKEN ||
    import.meta.env.VITE_EXO_MINT ||
    DEFAULT_EXO_TOKEN ||
    '',
).trim()
const caLive = Boolean(CA)

// Let the visitor spin the demo for a beat before nudging them toward the
// real thing — long enough to feel like their own discovery, short enough
// not to stall the funnel.
const MAP_PROMPT_DELAY_MS = 11000

// Small ghost/text-link action used for the prompt card's secondary
// actions — animated underline grows from the center on hover instead of
// a static border, so it reads as a deliberate micro-interaction rather
// than a default link style.
function UnderlineLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative px-1 py-1 text-[12px] font-medium text-muted transition-colors duration-200 ease-out hover:text-white"
    >
      {children}
      <span className="pointer-events-none absolute inset-x-1 bottom-0 h-px origin-center scale-x-0 bg-lime transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-x-100" />
    </button>
  )
}

export function Hero() {
  const lenisRef = useLenis()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [showMapPrompt, setShowMapPrompt] = useState(false)
  const settledRef = useRef(false) // true once the user has acted (either way) — stops the timer from firing late

  useEffect(() => {
    const timer = setTimeout(() => {
      if (settledRef.current) return
      if (document.body.classList.contains('term-open')) return
      setShowMapPrompt(true)
      window.__voidCosmos?.pauseDemo?.()
    }, MAP_PROMPT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    window.__voidDismissMapPrompt = () => {
      settledRef.current = true
      setShowMapPrompt(false)
    }
    return () => {
      delete window.__voidDismissMapPrompt
    }
  }, [])

  function goTo(target) {
    lenisRef?.current?.scrollTo(target, { offset: -20, duration: 1.4 })
  }

  function copyCA() {
    if (!caLive) return
    navigator.clipboard?.writeText(CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
  }

  // Shared by every "leave the demo" action in this section — the CTA row,
  // the panel's own action bar, and the prompt card — so the auto-prompt
  // timer can't fire late over a demo the visitor already left.
  // Navigates to the dedicated /map route instead of relocating this
  // page's own canvas into an in-page popup (the old mechanism, kept only
  // as a fallback the engine itself still uses for clicking a sector
  // directly in this small demo) — see MapPage.jsx for why.
  function openFullMap() {
    settledRef.current = true
    setShowMapPrompt(false)
    navigate('/map')
  }

  function keepSpinning() {
    settledRef.current = true
    setShowMapPrompt(false)
    window.__voidCosmos?.resumeDemo?.()
  }

  // Deliberately does NOT call resumeDemo() — per spec, leaving the small
  // hero demo paused once the visitor has moved on (in any direction) is
  // correct: it's a full-viewport overlay obscuring the canvas anyway, so
  // there's nothing gained by rendering underneath it. Only "keep spinning
  // this one" (below) explicitly opts back in.
  function askMindFromPrompt() {
    settledRef.current = true
    setShowMapPrompt(false)
    window.__openMindChat?.()
  }

  // Same reasoning as askMindFromPrompt — stays paused after navigating
  // away. The scroll-driven IntersectionObserver gate would eventually
  // pause it anyway once Hero scrolls out of view, but not resuming here
  // avoids a pointless few seconds of full-quality rendering mid-scroll.
  function whatIsItFromPrompt() {
    settledRef.current = true
    setShowMapPrompt(false)
    goTo('#concept')
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
          <i /> Live probe · voidmind online
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
            {caLive ? `$VOID · ${CA}` : 'CA TBA · mint not live'}
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

          <button type="button" className="btn-ghost" onClick={openFullMap}>
            Open full map
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="price-note"
        >
          Full map book: <b>$300,000</b> across 200 lots. Closer to the core = more expensive;
          rim lots start lower.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25 }}
        className="hero-cosmos-slot"
        id="heroCosmosSlot"
      >
        {/* Wrapper is just a positioning context for the overlay below — kept
            separate from CosmosPanel's own DOM node (#cosmosFrame), which
            the engine relocates wholesale into the arena on "open full
            map" (see voidEngine.js relocateTo/enterArena). If the overlay
            lived inside that node it would get dragged into the arena. */}
        <div className="relative">
          <CosmosPanel />

          {/* Teaser → conversion: darkens/blurs the live demo underneath and
              pauses its render loop (see voidEngine.js pauseDemo/resumeDemo)
              once the visitor's had a few seconds with it. */}
          <AnimatePresence>
            {showMapPrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="hero-map-prompt absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/55 backdrop-blur-md pointer-events-none"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className="pointer-events-auto mx-3 my-3 w-full max-w-[18rem] max-h-full overflow-y-auto rounded-2xl border border-lime/25 bg-black/80 p-5 text-center shadow-[0_0_40px_rgba(204,255,0,0.12)] sm:p-6"
                >
                  <p className="mb-1 text-[10px] tracking-[0.2em] text-lime/70">LIVE DEMO</p>
                  <h3 className="mb-2 font-display text-lg font-extrabold text-white">
                    This is one corner of it.
                  </h3>
                  <p className="mb-5 text-[13px] leading-relaxed text-muted">
                    500 systems, 50,000 sectors, and the claim book — all open in the full map.
                  </p>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, filter: 'brightness(1.08)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="btn-lime block w-full shadow-[0_0_0_rgba(204,255,0,0)] hover:shadow-[0_0_26px_rgba(204,255,0,0.5)]"
                    style={{ transition: 'box-shadow .25s ease-out' }}
                    onClick={openFullMap}
                  >
                    Open full map
                  </motion.button>

                  <div className="mt-4 flex items-center justify-center gap-1">
                    <UnderlineLink onClick={askMindFromPrompt}>Ask the mind</UnderlineLink>
                    <span className="text-muted-2">·</span>
                    <UnderlineLink onClick={whatIsItFromPrompt}>What is it?</UnderlineLink>
                  </div>

                  <button
                    type="button"
                    onClick={keepSpinning}
                    className="mt-4 text-[11px] text-muted-2 transition-colors duration-150 ease-out hover:text-lime"
                  >
                    ‹ keep spinning this one
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hero-map-actions" aria-label="map actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => document.getElementById('cosmosExploreBtn')?.click()}
          >
            Explore map
          </button>
          <button type="button" className="btn-lime" onClick={openFullMap}>
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
