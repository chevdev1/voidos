import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLenis } from '../lib/SmoothScroll'
import { ScrambleText } from './ScrambleText'
import { AccountMenu } from './AccountMenu'
import { BuyExoButton } from './BuyExoButton'
import { loadUser, mindSession, saveUser } from '../lib/mindClient'

const LINKS = [
  { label: 'MAP', target: '#map' },
  { label: 'ASK THE MIND', target: '#mind' },
  { label: 'CONCEPT', target: '#concept' },
  { label: 'MARKET', target: '#market' },
  { label: 'FAQ', target: '#faq' },
]

export function Nav() {
  const lenisRef = useLenis()
  const navigate = useNavigate()
  const loc = useLocation()
  const onHome = loc.pathname === '/'
  const [hasWallet, setHasWallet] = useState(() => Boolean(loadUser()?.wallet))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    mindSession()
      .then((data) => {
        if (data.user) saveUser(data.user)
        setHasWallet(Boolean(data.user?.wallet))
      })
      .catch(() => {})
    const onUser = (e) => setHasWallet(Boolean(e.detail?.wallet))
    window.addEventListener('void-user', onUser)
    return () => window.removeEventListener('void-user', onUser)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  function goTo(target) {
    setMenuOpen(false)
    if (target === '#map') {
      navigate('/map')
      return
    }
    if (target === '#mind') {
      window.__openMindChat?.()
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
      className="fixed inset-x-0 top-0 z-[200] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-void via-void/85 to-transparent" />

      <div className="flex min-h-12 items-center justify-between gap-2">
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
          {hasWallet && (
            <Link
              to="/cabinet"
              className="transition-colors duration-150 ease-out hover:text-lime"
              title="личный кабинет"
            >
              <ScrambleText text="CABINET" trigger="hover" duration={400} />
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <AccountMenu />
          {onHome && (
            <span className="hidden sm:inline-flex">
              <BuyExoButton
                filled
                label="Buy $TEST"
                onFallback={() => goTo('#market')}
                className="!px-3 !py-2 !text-[10px]"
              />
            </span>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center border border-white/20 text-ink transition hover:border-lime/50 hover:text-lime lg:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="relative block h-3.5 w-4">
              <span
                className={`absolute left-0 block h-px w-full bg-current transition ${menuOpen ? 'top-1.5 rotate-45' : 'top-0'}`}
              />
              <span
                className={`absolute left-0 top-1.5 block h-px w-full bg-current transition ${menuOpen ? 'opacity-0' : ''}`}
              />
              <span
                className={`absolute left-0 block h-px w-full bg-current transition ${menuOpen ? 'top-1.5 -rotate-45' : 'top-3'}`}
              />
            </span>
          </button>
        </div>
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
              className="fixed inset-0 z-[45] bg-black/75 backdrop-blur-sm lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-3 top-[calc(100%+6px)] z-[46] max-h-[min(78dvh,520px)] overflow-y-auto border border-lime/35 bg-black/97 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.65)] lg:hidden"
              role="dialog"
              aria-modal="true"
            >
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-lime">navigate</p>
              <div className="flex flex-col gap-1">
                {onHome &&
                  LINKS.map((link) => (
                    <button
                      key={link.target}
                      type="button"
                      onClick={() => goTo(link.target)}
                      className="border border-white/10 px-3 py-3.5 text-left text-[13px] tracking-[0.12em] text-ink transition hover:border-lime/40 hover:text-lime"
                    >
                      {link.label}
                    </button>
                  ))}
                {hasWallet && (
                  <Link
                    to="/cabinet"
                    onClick={() => setMenuOpen(false)}
                    className="border border-lime/40 bg-lime/10 px-3 py-3.5 text-[13px] tracking-[0.12em] text-lime"
                  >
                    CABINET / ЛК
                  </Link>
                )}
                {!onHome && (
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className="border border-white/10 px-3 py-3.5 text-[13px] tracking-[0.12em] text-ink"
                  >
                    HOME
                  </Link>
                )}
              </div>
              {onHome && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <BuyExoButton
                    filled
                    label="Buy $TEST · soon"
                    onFallback={() => goTo('#market')}
                    className="!w-full !justify-center !rounded-none !px-4 !py-3.5 !text-[12px]"
                  />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
