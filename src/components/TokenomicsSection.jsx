import { motion } from 'framer-motion'
import { ScrambleText } from './ScrambleText'
import '../legacy/void.css'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const pop = {
  hidden: { opacity: 0, scale: 0.85, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
}

const STATS = [
  { v: '1B', l: 'Supply' },
  { v: '$EXO', l: 'Ticker' },
  { v: '50k', l: 'Sectors' },
  { v: '0/0', l: 'Tax' },
]

export function TokenomicsSection() {
  return (
    <section className="void section center" id="token">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5 }}
      >
        <div className="eyebrow">
          <ScrambleText text="TOKENOMICS" duration={450} />
        </div>
        <h2>
          No tricks. <em>Just burn.</em>
        </h2>
      </motion.div>

      <motion.div
        className="stats"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        {STATS.map((s) => (
          <motion.div key={s.l} variants={pop} className="stat">
            <b>{s.v}</b>
            <span>{s.l}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
