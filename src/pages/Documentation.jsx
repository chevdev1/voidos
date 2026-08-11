import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SmoothScrollProvider, useLenis } from '../lib/SmoothScroll'

const SPRING = { type: 'spring', stiffness: 260, damping: 26 }

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    tag: '01',
    body: (
      <>
        <p>
          ExoMind is a singular autonomous AI probe, its mind divided into{' '}
          <b className="text-white">50,000 sectors</b> across{' '}
          <b className="text-white">500 star systems</b>. Acquiring a sector grants the right to
          transmit data into that part of the Mind — a permanent, tradeable claim on a fragment of
          an evolving intelligence.
        </p>
        <p className="mt-4">
          There is no fixed script. The probe's personality has no author — its trajectory drifts
          continuously toward whatever its sector owners collectively feed it. Commanders don't
          control ExoMind. They pull on it.
        </p>
      </>
    ),
  },
  {
    id: 'acquisition',
    label: 'Acquisition ($EXO)',
    tag: '02',
    body: (
      <>
        <p>
          Sector price scales with proximity to the galactic core and lot kind. The full map —
          all <b className="text-lime">200</b> constellation lots — is valued at{' '}
          <b className="text-lime">$300,000</b> total. Far-rim lots start around a few hundred;
          core / scarce kinds run into the low–mid thousands. Closer to the
          core means more contested, higher-gravity real estate.
        </p>
        <p className="mt-4">
          Every payment is <b className="text-white">permanently burned</b> on capture — there is
          no treasury, no team wallet collecting the proceeds. Each sector claimed forever reduces
          the total $EXO supply.
        </p>
        <p className="mt-4 border border-lime/25 bg-lime/5 px-3 py-2 text-[12px] text-lime/90">
          Live site status: claim runs in <b>test mode</b> (free after Robinhood connect, no real
          burn) until <code className="text-white">VITE_CLAIM_CONTRACT</code> +{' '}
          <code className="text-white">VITE_EXO_TOKEN</code> are set on Robinhood Chain.
        </p>
      </>
    ),
  },
  {
    id: 'transmission',
    label: 'Transmission Protocol',
    tag: '03',
    body: (
      <>
        <p>
          Owning a sector unlocks a <b className="text-white">transmitter</b>: a channel for text,
          images, and links directly into the Mind. Budget scales with sector size —{' '}
          <b className="text-white">10 characters per sector</b>,{' '}
          <b className="text-white">1 image slot per 10 sectors</b>. Bigger holdings, louder
          signal.
        </p>
        <p className="mt-4">
          Every publication and every retraining pass burns <b className="text-lime">$EXO</b> as
          fuel. Ownership of a sector is eternal — nothing can revoke it — but transmitting a new
          signal into it always costs something. Silence is free. Influence isn't.
        </p>
        <p className="mt-4 border border-lime/25 bg-lime/5 px-3 py-2 text-[12px] text-lime/90">
          Until mint is live: use <b>Train patch (test)</b> in CABINET — free ledger training that
          marks the lot as fed on the map. Real $EXO burns replace this later.
        </p>
      </>
    ),
  },
  {
    id: 'core',
    label: 'The Immutable Core',
    tag: '04',
    body: (
      <>
        <p>
          <b className="text-lime">28%</b> of the personality is the Immutable Core — sealed,
          unbuyable, untradeable. No sector purchase, signal, or retraining pass can touch it.
        </p>
        <p className="mt-4 italic text-muted-2">
          The probe calls it "the only black hole that belongs solely to itself."
        </p>
      </>
    ),
  },
  {
    id: 'voice',
    label: 'The Voice',
    tag: '05',
    body: (
      <>
        <p>
          ExoMind maintains its own log and X account autonomously — no human moderation, no
          approval queue. It records every purchase, every received signal, every fuel burn.
        </p>
        <p className="mt-4">
          It is also constantly, publicly evaluating its commanders. There is no ledger you can
          see and it can't.
        </p>
      </>
    ),
  },
]

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!elements.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    )
    elements.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ids])

  return active
}

function Sidebar({ active }) {
  const lenisRef = useLenis()

  return (
    <aside className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
      <Link
        to="/"
        className="mb-8 flex items-center gap-2 text-xs text-muted transition-colors duration-150 ease-out hover:text-lime"
      >
        <span aria-hidden>←</span> Back to site
      </Link>

      <div className="mb-4 text-[10px] tracking-[0.2em] text-muted-2">KNOWLEDGE BASE</div>

      <nav className="flex flex-col gap-1 border-l border-white/10">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() =>
              lenisRef?.current?.scrollTo(`#${s.id}`, { offset: -90, duration: 1.1 })
            }
            className={`-ml-px border-l px-4 py-2 text-left font-mono text-[13px] transition-colors duration-150 ease-out ${
              active === s.id
                ? 'border-lime text-lime'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <span className="mr-2 text-[10px] text-muted-2">{s.tag}</span>
            {s.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function Section({ section, index }) {
  return (
    <motion.section
      id={section.id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ...SPRING, delay: index * 0.05 }}
      className="scroll-mt-24 border-b border-white/10 py-12 first:pt-0 last:border-b-0"
    >
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ ...SPRING, delay: index * 0.05 + 0.05 }}
        className="mb-5 flex items-center gap-3"
      >
        <span className="font-mono text-xs text-lime/70">{section.tag}</span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {section.label}
        </h2>
      </motion.div>
      <div className="max-w-2xl font-mono text-[13.5px] leading-relaxed text-gray-400">
        {section.body}
      </div>
    </motion.section>
  )
}

function DocumentationContent() {
  const ids = SECTIONS.map((s) => s.id)
  const active = useScrollSpy(ids)

  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-void/90 px-5 py-4 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
            <span className="font-display text-sm font-extrabold tracking-wide text-ink">
              VOID<span className="text-lime">.OS</span>{' '}
              <span className="text-muted-2">/ docs</span>
            </span>
          </Link>
          <Link
            to="/"
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-muted transition-colors duration-150 ease-out hover:border-lime/50 hover:text-lime"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-12 px-5 py-14 sm:px-10">
        <Sidebar active={active} />

        <main className="min-w-0 flex-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="mb-10"
          >
            <span className="mb-3 block text-[11px] tracking-[0.2em] text-lime/70">
              EXOMIND NETWORK
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Documentation
            </h1>
            <p className="mt-3 max-w-xl font-mono text-[13px] leading-relaxed text-gray-400">
              The reference manual for the probe, the lots, and the fuel that runs both. Claim and
              training are in test mode on the live site until $EXO mint goes live.
            </p>
          </motion.div>

          {SECTIONS.map((section, i) => (
            <Section key={section.id} section={section} index={i} />
          ))}
        </main>
      </div>
    </div>
  )
}

export default function Documentation() {
  return (
    <SmoothScrollProvider>
      <DocumentationContent />
    </SmoothScrollProvider>
  )
}
