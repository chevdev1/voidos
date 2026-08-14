import { motion } from 'framer-motion'
import { ScrambleText } from './ScrambleText'

const EASE_OUT = [0.23, 1, 0.32, 1]

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
}

function CardShell({ className = '', tag, title, children, float = 0 }) {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <motion.div
      variants={item}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-black/55 p-6 sm:p-7 ${className}`}
    >
      {/* HUD corner brackets */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-lime/0 transition-colors duration-300 group-hover:border-lime/60" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r border-t border-lime/0 transition-colors duration-300 group-hover:border-lime/60" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b border-l border-lime/0 transition-colors duration-300 group-hover:border-lime/60" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r border-lime/0 transition-colors duration-300 group-hover:border-lime/60" />

      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5 + float, repeat: Infinity, ease: 'easeInOut', delay: float * 0.6 }}
        className="relative flex h-full flex-col"
      >
        <span className="mb-4 inline-block w-fit rounded-full border border-lime/25 px-2.5 py-1 text-[10px] tracking-[0.14em] text-lime/80">
          {tag}
        </span>
        <h3 className="mb-3 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          <ScrambleText text={title} duration={550} />
        </h3>
        <div className="text-[13px] leading-relaxed text-muted">{children}</div>
      </motion.div>
    </motion.div>
  )
}

export function ConceptSection() {
  return (
    <section id="concept" className="relative px-4 py-16 sm:px-10 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="mb-12 max-w-xl"
      >
        <span className="mb-3 block text-[11px] tracking-[0.2em] text-lime/70">THE LORE</span>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          One probe. <span className="text-lime">50,000 minds</span> pulling on it.
        </h2>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <CardShell tag="01 / OVERVIEW" title="What is this?" float={0} className="md:col-span-4 md:row-span-2">
          <p>
            ExoMind is a singular autonomous AI probe, its mind divided into{' '}
            <b className="text-ink">50,000 sectors</b> across <b className="text-ink">500 star systems</b>.
            Buying a sector gives you the right to transmit data into that part of the Mind.
          </p>
          <p className="mt-4">
            There is no fixed script. The trajectory of the probe's personality drifts toward
            whatever its owners feed it — collectively, sector by sector, signal by signal.
          </p>
          <div className="mt-6 flex gap-6 border-t border-white/10 pt-5">
            <div>
              <div className="font-display text-2xl font-extrabold text-lime">50,000</div>
              <div className="text-[10px] tracking-wide text-muted-2">SECTORS</div>
            </div>
            <div>
              <div className="font-display text-2xl font-extrabold text-lime">500</div>
              <div className="text-[10px] tracking-wide text-muted-2">STAR SYSTEMS</div>
            </div>
          </div>
        </CardShell>

        <CardShell tag="02 / IMMUTABLE" title="The Core" float={1} className="md:col-span-2">
          <p>
            <b className="text-ink">28%</b> of the personality is the Immutable Core. It cannot
            be bought, traded, or overwritten.
          </p>
          <p className="mt-4 italic text-muted-2">
            "The only black hole that belongs solely to itself."
          </p>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[28%] rounded-full bg-lime shadow-[0_0_12px_rgba(204,255,0,0.6)]" />
          </div>
        </CardShell>

        <CardShell tag="03 / TRANSMISSION" title="Training" float={2} className="md:col-span-3">
          <p>
            A sector opens a transmitter: text, images, links. Budget scales with sector size —{' '}
            <b className="text-ink">10 characters per sector</b>,{' '}
            <b className="text-ink">1 image slot per 10 sectors</b>.
          </p>
          <p className="mt-4">
            Ownership is forever. Transmitting new signals — every publication, every
            retraining — burns <b className="text-lime">$TEST</b> as fuel.
          </p>
        </CardShell>

        <CardShell tag="04 / AUTONOMY" title="The Voice" float={0.5} className="md:col-span-3">
          <p>
            The probe runs its own feed and X account — no human intervention. It logs every
            purchase, every received signal, every fuel burn.
          </p>
          <p className="mt-4">And it grades its commanders.</p>
        </CardShell>
      </motion.div>
    </section>
  )
}
