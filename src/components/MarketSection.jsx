import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { ScrambleText } from './ScrambleText'
import { BuyExoButton } from './BuyExoButton'
import { VoidChart } from './VoidChart'
import { getDexUrl, getExoCa, copyExoCa } from '../lib/buyExo'
import { DEFAULT_GECKO_URL } from '../../shared/rhChain.js'
import { candlesForTimeframe } from '../../shared/geckoMarket.js'
import '../legacy/void.css'

const EASE_OUT = [0.23, 1, 0.32, 1]
const TFS = ['1m', '15m', '1h', '1D']

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

function fmtP(p) {
  const n = Number(p)
  if (!n) return '—'
  if (n >= 1) return '$' + n.toFixed(4)
  if (n >= 0.01) return '$' + n.toFixed(5)
  return '$' + n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

function fmtM(n) {
  const v = Number(n)
  if (!v) return '—'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(2) + 'K'
  return '$' + v.toFixed(0)
}

export function MarketSection() {
  const dex = getDexUrl()
  const ca = getExoCa()
  const [copied, setCopied] = useState(false)
  const [tf, setTf] = useState('15m')
  const [feed, setFeed] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let dead = false
    async function load() {
      try {
        const r = await fetch('/api/market?tf=15m', { cache: 'no-store' })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'feed failed')
        if (!dead) {
          setFeed(j)
          setErr('')
        }
      } catch (e) {
        if (!dead) setErr(e.message || 'feed failed')
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      dead = true
      clearInterval(id)
    }
  }, [])

  const candles = useMemo(
    () => candlesForTimeframe(feed?.series || feed?.candles || [], tf),
    [feed, tf],
  )

  async function onCopyCa() {
    const ok = await copyExoCa()
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const chg = feed?.chg24
  const chgCls = chg > 0 ? 'v up' : chg < 0 ? 'v dn' : 'v'

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
          $TEST / <em>VOID</em>
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
            {fmtP(feed?.price)}
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">Market Cap</div>
          <div className="v" id="mCap">
            {fmtM(feed?.mcap)}
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">Liquidity</div>
          <div className="v" id="mLiq">
            {fmtM(feed?.liq)}
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="m-stat">
          <div className="l">24h</div>
          <div className={chgCls} id="mChg">
            {chg == null || Number.isNaN(Number(chg))
              ? '—'
              : (chg >= 0 ? '+' : '') + Number(chg).toFixed(2) + '%'}
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        id="market-buy"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.08 }}
        className="market-buy sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-lime">buy $test</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted sm:text-[14px]">
            Swap $TEST on Robinhood Chain, then claim constellation lots on the map.
          </p>
          {ca ? (
            <button type="button" onClick={onCopyCa} className="ca-pill" title="Copy contract address">
              <span className="text-[9px] uppercase tracking-[0.14em] text-muted">CA</span>
              <span className="truncate">{copied ? 'copied ✓' : `${ca.slice(0, 8)}…${ca.slice(-6)}`}</span>
            </button>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted">CA TBA</p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row">
          <BuyExoButton
            filled
            className="!w-full !justify-center sm:!w-auto"
            label={dex ? 'Buy $TEST' : ca ? 'Copy CA' : 'Buy $TEST · soon'}
          />
          <button
            type="button"
            className="w-full rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-[11px] tracking-wide text-muted hover:border-lime/40 hover:text-lime sm:w-auto sm:py-2"
            onClick={() => {
              if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
              else if (window.__openFullMap) window.__openFullMap()
              else window.__voidCosmosPendingEnter = true
            }}
          >
            claim on map
          </button>
        </div>
      </motion.div>

      <motion.div
        className="chart-panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.15 }}
      >
        <div className="chart-tools">
          <div className="min-w-0">
            <p className="pair">
              TEST <em>/ USD</em>
            </p>
            <p className="mt-1 font-mono text-[11px]">
              <span className="text-lime">{fmtP(feed?.price)}</span>
              <span className={`ml-2 ${chg > 0 ? 'text-[#ccff00]' : chg < 0 ? 'text-[#ff5a6a]' : 'text-muted'}`}>
                {chg == null || Number.isNaN(Number(chg))
                  ? ''
                  : (chg >= 0 ? '+' : '') + Number(chg).toFixed(2) + '% 24h'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={DEFAULT_GECKO_URL}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-muted hover:text-lime"
            >
              gecko
            </a>
            <div className="tfs" id="tfs">
              {TFS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={'tf' + (tf === key ? ' on' : '')}
                  onClick={() => setTf(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
        <VoidChart
          key={tf}
          candles={candles}
          tf={tf}
          emptyHint={err ? 'feed offline' : 'indexing prints…'}
        />
      </motion.div>
    </section>
  )
}
