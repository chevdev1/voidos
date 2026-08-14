import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
const MAP_PROMPT_DELAY_MS = 11000

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
  const settledRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (settledRef.current) return
      setShowMapPrompt(true)
    }, MAP_PROMPT_DELAY_MS)
    return () => clearTimeout(timer)
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

  function askMindFromPrompt() {
    settledRef.current = true
    setShowMapPrompt(false)
    window.__openMindChat?.()
  }

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
              <a href={X_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                Follow
              </a>
            ) : null}
            {TG_URL ? (
              <a href={TG_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
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
        <div className="relative h-full min-h-inherit">
          <CosmosPanel />

          <AnimatePresence>
            {showMapPrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className="mx-4 max-w-xs rounded-2xl border border-lime/25 bg-black/80 p-6 text-center shadow-[0_0_40px_rgba(204,255,0,0.12)]"
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
                    className="btn-lime block w-full"
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
      </motion.div>
    </section>
  )
}
