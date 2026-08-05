import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'
import { MagneticButton } from './MagneticButton'
import { ScrambleText } from './ScrambleText'
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
          Sectors are scattered organic clusters — not a grid.{' '}
          <b>Closer to a galaxy core = more expensive.</b> Outer rim is cheap fuel for wild signals.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25 }}
        className="hero-right"
        id="cosmosFrame"
      >
        <div className="cosmos-bar">
          <b>◎ COSMOS</b>
          <span id="cosmosHint">click map to explore · then wheel zooms · leave to scroll page</span>
        </div>
        <canvas id="cosmos" />
        <div className="cosmos-fx" aria-hidden="true" />
        <div className="cosmos-scan" aria-hidden="true" />
        <div className="cosmos-hud">
          <div className="tag">THE VOID · EXOMIND</div>
          <div className="pill">
            <div className="lab">✦ burned forever</div>
            <div className="num" id="burned">
              7,218,018
            </div>
            <div className="sub">$EXO · 0.72% of supply · 1,000,000,000 ever minted</div>
          </div>
          <div className="zoom-lvl">
            view · <b id="zoomLabel">EXOMIND</b>
          </div>
        </div>
        <div className="tip" id="tip">
          <div className="t1" id="tip1">
            sector #0
          </div>
          <div className="t2" id="tip2">
            —
          </div>
        </div>
        <div className="vc">
          <button id="searchBtn" title="find grain #">
            ⌕
          </button>
          <button id="zoomIn" title="zoom in">
            +
          </button>
          <button id="zoomOut" title="zoom out">
            −
          </button>
          <button id="homeBtn" title="reset">
            ⌂
          </button>
          <button id="orbitBtn" className="on" title="orbit 360°">
            ⊕
          </button>
          <button id="spinBtn" className="on" title="auto spin">
            ⟳
          </button>
        </div>
        <div className="filters" id="filters">
          <span className="fchip on" data-f="empty">
            <i className="box" />
            empty
          </span>
          <span className="fchip on" data-f="claimed">
            <i className="box" />
            claimed
          </span>
          <span className="fchip on" data-f="fed">
            <i className="box" />
            fed
          </span>
          <span className="fchip on" data-f="core">
            <i className="box" />
            core
          </span>
          <span className="fchip" data-f="heat">
            <i className="box" />
            heat
          </span>
          <span className="fchip on" data-f="yours">
            <i className="box" />
            yours <b id="yoursCnt">0</b>
          </span>
        </div>
        <div className="minimap">
          <canvas id="mini" width="240" height="170" />
          <div className="cap" id="miniCap">
            0 grains · map
          </div>
        </div>
      </motion.div>

      <div className="scroll-cue">
        <ScrambleText text="SCROLL FOR LORE" trigger="view" />
        <i />
      </div>
    </section>
  )
}
