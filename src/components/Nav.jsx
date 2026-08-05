import { motion } from 'framer-motion'
import { useLenis } from '../lib/SmoothScroll'
import { ScrambleText } from './ScrambleText'

const LINKS = [
  { label: 'MAP', target: '#map' },
  { label: 'CONCEPT', target: '#concept' },
  { label: 'MARKET', target: '#market' },
  { label: 'FAQ', target: '#faq' },
]

export function Nav() {
  const lenisRef = useLenis()

  function goTo(target) {
    if (target === '#map') {
      if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
      else window.__voidCosmosPendingEnter = true
    }
    lenisRef?.current?.scrollTo(target, { offset: target === '#map' ? 0 : -24, duration: 1.3 })
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-void via-void/80 to-transparent" />

      <a href="#top" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); goTo('#top') }}>
        <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
        <span className="font-display text-sm font-extrabold tracking-wide text-ink">
          VOID<span className="text-lime">.OS</span>
        </span>
      </a>

      <nav className="hidden items-center gap-6 text-xs tracking-[0.08em] text-muted lg:flex">
        {LINKS.map((link) => (
          <button
            key={link.target}
            onClick={() => goTo(link.target)}
            className="transition-colors duration-150 ease-out hover:text-lime"
          >
            <ScrambleText text={link.label} trigger="hover" duration={400} />
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        <a
          href="#"
          className="hidden h-[30px] w-[30px] items-center justify-center rounded-full border border-white/10 text-xs text-muted transition-colors duration-150 ease-out hover:border-lime/50 hover:text-lime sm:flex"
        >
          𝕏
        </a>
        <a
          href="#"
          className="hidden h-[30px] w-[30px] items-center justify-center rounded-full border border-white/10 text-xs text-muted transition-colors duration-150 ease-out hover:border-lime/50 hover:text-lime sm:flex"
        >
          ✈
        </a>
        <button
          onClick={() => goTo('#market')}
          className="rounded-full border border-lime/40 bg-lime/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-lime transition-all duration-200 ease-out hover:bg-lime hover:text-black"
        >
          Buy $EXO
        </button>
      </div>
    </motion.header>
  )
}
