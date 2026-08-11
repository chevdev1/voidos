import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLenis } from '../lib/SmoothScroll'
import { ScrambleText } from './ScrambleText'
import { AccountMenu } from './AccountMenu'
import { BuyExoButton } from './BuyExoButton'
import { loadUser, mindSession, saveUser } from '../lib/mindClient'

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
  const [hasWallet, setHasWallet] = useState(() => Boolean(loadUser()?.wallet))

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

  function goTo(target) {
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
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-void via-void/80 to-transparent" />

      <Link
        to="/"
        className="flex items-center gap-2.5"
        onClick={(e) => {
          if (onHome) {
            e.preventDefault()
            goTo('#top')
          }
        }}
      >
        <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
        <span className="font-display text-sm font-extrabold tracking-wide text-ink">
          VOID<span className="text-lime">.OS</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-6 text-xs tracking-[0.08em] text-muted lg:flex">
        {onHome &&
          LINKS.map((link) => (
            <button
              key={link.target}
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

      <div className="flex items-center gap-2.5">
        {hasWallet && (
          <Link
            to="/cabinet"
            className="rounded-full border border-white/15 px-3 py-2 text-[11px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime lg:hidden"
          >
            cabinet
          </Link>
        )}
        <AccountMenu />
        {onHome && (
          <BuyExoButton filled onFallback={() => goTo('#market')} />
        )}
      </div>
    </motion.header>
  )
}
