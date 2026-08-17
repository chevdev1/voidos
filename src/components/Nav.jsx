import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLenis } from '../lib/SmoothScroll'
import { ScrambleText } from './ScrambleText'
import { AccountMenu } from './AccountMenu'
import { BuyExoButton } from './BuyExoButton'
import { VoidLogo } from './VoidLogo'
import { loadUser, mindSession, saveUser } from '../lib/mindClient'

const LINKS = [
  { label: 'MAP', to: '/map' },
  { label: 'CABINET', to: '/cabinet' },
  { label: 'ASK THE MIND', hash: '#mind' },
  { label: 'CONCEPT', hash: '#concept' },
  { label: 'MARKET', hash: '#market' },
  { label: 'FAQ', hash: '#faq' },
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

  function goHash(hash) {
    setMenuOpen(false)
    if (hash === '#mind') {
      window.__openMindChat?.()
      return
    }
    if (!onHome) {
      navigate({ pathname: '/', hash: hash.replace(/^#/, '') })
      return
    }
    const lenis = lenisRef?.current
    if (lenis?.scrollTo) {
      lenis.scrollTo(hash, { offset: -24, duration: 1.3 })
      return
    }
    const el = document.querySelector(hash)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 24
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  function goLink(link) {
    setMenuOpen(false)
    if (link.to) {
      navigate(link.to)
      return
    }
    if (link.hash) goHash(link.hash)
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-[200] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-void via-void/85 to-transparent" />

      <div className="flex min-h-14 items-center justify-between gap-2 sm:min-h-16">
        <Link
          to="/"
          className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
          onClick={(e) => {
            if (onHome) {
              e.preventDefault()
              goHash('#top')
            }
          }}
        >
          <VoidLogo className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
          <span className="font-display text-sm font-extrabold tracking-wide text-ink sm:text-base">
            VOID<span className="text-lime">.OS</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-4 overflow-x-auto text-[11px] tracking-[0.08em] text-muted xl:flex">
          {LINKS.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => goLink(link)}
              className="shrink-0 transition-colors duration-150 ease-out hover:text-lime"
            >
              <ScrambleText text={link.label} trigger="hover" duration={400} />
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <AccountMenu />
          <BuyExoButton
            filled
            label="Buy $TEST"
            onFallback={() => goHash('#market')}
            className="!px-2.5 !py-2 !text-[10px] sm:!px-3"
          />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center border border-white/20 text-ink transition hover:border-lime/50 hover:text-lime xl:hidden"
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
              className="fixed inset-0 z-[45] bg-black/75 xl:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-3 top-[calc(100%+6px)] z-[46] max-h-[min(78dvh,560px)] overflow-y-auto border border-lime/35 bg-black p-4 xl:hidden"
              role="dialog"
              aria-modal="true"
            >
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-lime">navigate</p>
              <div className="flex flex-col gap-1">
                {LINKS.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => goLink(link)}
                    className="border border-white/10 px-3 py-3.5 text-left text-[13px] tracking-[0.12em] text-ink transition hover:border-lime/40 hover:text-lime"
                  >
                    {link.label}
                    {link.to === '/cabinet' && hasWallet ? ' · linked' : ''}
                  </button>
                ))}
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="border border-white/10 px-3 py-3.5 text-[13px] tracking-[0.12em] text-ink"
                >
                  HOME
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
