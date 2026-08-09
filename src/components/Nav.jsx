import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useLenis } from '../lib/SmoothScroll'
import { ScrambleText } from './ScrambleText'
import { AccountMenu } from './AccountMenu'

const LINKS = [
  { label: 'MAP', target: '#map' },
  { label: 'CONCEPT', target: '#concept' },
  { label: 'MARKET', target: '#market' },
  { label: 'FAQ', target: '#faq' },
]

export function Nav() {
  const lenisRef = useLenis()
  const loc = useLocation()
  const onHome = loc.pathname === '/'
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function goTo(target) {
    setMenuOpen(false)
    if (target === '#map') {
      if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
      else if (window.__openFullMap) window.__openFullMap()
      else window.__voidCosmosPendingEnter = true
      return
    }
    const lenis = lenisRef?.current
    if (lenis?.scrollTo) {
      lenis.scrollTo(target, { offset: -24, duration: 1.3 })
      return
    }
    const el = document.querySelector(target)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 24
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4 lg:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-void via-void/80 to-transparent" />

      <Link
        to="/"
        className="flex min-w-0 shrink items-center gap-2"
        onClick={(e) => {
          if (onHome) {
            e.preventDefault()
            goTo('#top')
          }
        }}
      >
        <img src="/assets/void-logo.png" alt="" className="h-6 w-6 shrink-0" />
        <span className="font-display text-sm font-extrabold tracking-wide text-ink">
          VOID<span className="text-lime">.OS</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-6 text-xs tracking-[0.08em] text-muted lg:flex">
        {onHome &&
          LINKS.map((link) => (
            <button
              key={link.target}
              type="button"
              onClick={() => goTo(link.target)}
              className="transition-colors duration-150 ease-out hover:text-lime"
            >
              <ScrambleText text={link.label} trigger="hover" duration={400} />
            </button>
          ))}
        <Link
          to="/cabinet"
          className="transition-colors duration-150 ease-out hover:text-lime"
          title="личный кабинет"
        >
          <ScrambleText text="CABINET" trigger="hover" duration={400} />
        </Link>
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          className="grid h-11 min-w-11 place-items-center rounded-full border border-white/15 text-[11px] tracking-wide text-muted hover:border-lime/50 hover:text-lime lg:hidden"
          aria-label="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <AccountMenu />
        {onHome && (
          <button
            type="button"
            onClick={() => goTo('#market')}
            className="hidden min-h-11 rounded-full border border-lime/40 bg-lime/10 px-3 py-2 text-[11px] font-semibold tracking-wide text-lime transition-all hover:bg-lime hover:text-black sm:inline-flex sm:items-center sm:px-4"
          >
            Buy $EXO
          </button>
        )}
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/60 lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="fixed inset-x-3 z-[56] border border-lime/35 bg-black/95 p-3 shadow-xl backdrop-blur-md lg:hidden"
              style={{ top: 'calc(env(safe-area-inset-top) + 3.25rem)' }}
            >
              <div className="flex flex-col gap-1">
                {onHome &&
                  LINKS.map((link) => (
                    <button
                      key={link.target}
                      type="button"
                      onClick={() => goTo(link.target)}
                      className="min-h-11 border border-transparent px-3 text-left text-[12px] tracking-[0.12em] text-muted hover:border-lime/30 hover:text-lime"
                    >
                      {link.label}
                    </button>
                  ))}
                <Link
                  to="/cabinet"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center border border-lime/40 bg-lime/10 px-3 text-[12px] tracking-[0.12em] text-lime"
                >
                  CABINET / ЛК
                </Link>
                {onHome && (
                  <button
                    type="button"
                    onClick={() => goTo('#market')}
                    className="min-h-11 bg-lime px-3 text-left text-[12px] font-semibold tracking-[0.12em] text-black sm:hidden"
                  >
                    BUY $EXO
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
