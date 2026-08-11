import { motion } from 'framer-motion'
import { useState } from 'react'
import { ScrambleText } from './ScrambleText'
import { BuyExoButton } from './BuyExoButton'
import { getDexUrl, getExoCa, copyExoCa } from '../lib/buyExo'
import '../legacy/void.css'

const EASE_OUT = [0.23, 1, 0.32, 1]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

export function MarketSection() {
  const dex = getDexUrl()
  const ca = getExoCa()
  const [copied, setCopied] = useState(false)

  async function onCopyCa() {
    const ok = await copyExoCa()
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="void section" id="market">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <div className="eyebrow">
          <ScrambleText text="MARKET" duration={450} />
        </div>
        <h2>
          $EXO / <em>VOID</em>
        </h2>
      </motion.div>

      <motion.div
        className="m-stats"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">Price</div>
          <div className="v lime" id="mPrice">
            $0.002278
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">Market Cap</div>
          <div className="v" id="mCap">
            $2.16M
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">Liquidity</div>
          <div className="v" id="mLiq">
            $1.30M
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">24h</div>
          <div className="v up" id="mChg">
            +64.86%
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        id="market-buy"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.08 }}
        className="mt-6 flex flex-col gap-4 border border-lime/30 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-lime">buy $exo</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted sm:text-sm">
            {dex
              ? 'Open the Dex to swap into $EXO on Robinhood Chain.'
              : ca
                ? 'Token CA is live — copy it into your wallet / Dex.'
                : 'Token not listed yet. Claim lots in test mode on the map until mint is live.'}
          </p>
          {ca ? (
            <button
              type="button"
              onClick={onCopyCa}
              className="mt-2 max-w-full truncate font-mono text-[11px] text-lime/90 hover:text-lime"
              title="Copy contract address"
            >
              {copied ? 'copied ✓' : ca}
            </button>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted">CA TBA</p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap">
          <BuyExoButton
            filled
            className="!w-full !justify-center sm:!w-auto"
            label={dex ? 'Buy on Dex ↗' : ca ? 'Copy CA' : 'Buy $EXO · soon'}
          />
          <button
            type="button"
            className="w-full rounded-full border border-white/20 px-4 py-2.5 text-[11px] tracking-wide text-muted hover:border-lime/40 hover:text-lime sm:w-auto sm:py-2"
            onClick={() => {
              if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
              else if (window.__openFullMap) window.__openFullMap()
              else window.__voidCosmosPendingEnter = true
            }}
          >
            claim lots on map
          </button>
        </div>
      </motion.div>

      <motion.div
        className="chart-panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.15 }}
      >
        <div className="chart-tools">
          <span>EXO / USD</span>
          <div className="tfs" id="tfs">
            <button className="tf" data-n="90">
              1m
            </button>
            <button className="tf on" data-n="70">
              15m
            </button>
            <button className="tf" data-n="55">
              1h
            </button>
            <button className="tf" data-n="40">
              1D
            </button>
          </div>
        </div>
        <div className="chart-box" id="chartBox">
          <canvas id="chart" />
        </div>
      </motion.div>
    </section>
  )
}
