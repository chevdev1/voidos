import { motion } from 'framer-motion'
import { ScrambleText } from './ScrambleText'
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
