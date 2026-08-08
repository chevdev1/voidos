import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { mindSession, loadOwnerships, loadUser } from '../lib/mindClient'
import { LotFigure, buildLotProfile } from '../components/LotFigure'
import { AccountMenu } from '../components/AccountMenu'
import { MindChat } from '../components/MindChat'

/**
 * Personal cabinet — owned constellation lots, drawn + readable lore.
 */
export default function Cabinet() {
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [user, setUser] = useState(() => loadUser())
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await mindSession()
        if (cancelled) return
        setOwnerships(data.ownerships || [])
        setUser(data.user || null)
        if (!selectedId && data.ownerships?.length) {
          setSelectedId(data.ownerships[0].constel_id)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const profiles = useMemo(
    () => ownerships.map((o) => ({ lot: o, profile: buildLotProfile(o) })),
    [ownerships],
  )

  const active =
    profiles.find((p) => p.lot.constel_id === selectedId) || profiles[0] || null

  useEffect(() => {
    if (active && selectedId !== active.lot.constel_id) {
      setSelectedId(active.lot.constel_id)
    }
  }, [active, selectedId])

  const who = user?.registered ? user.displayName : 'visitor'

  return (
    <div className="min-h-screen bg-void text-ink">
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(204,255,0,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(204,255,0,0.04), transparent)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
          <span className="font-display text-sm font-extrabold tracking-wide">
            VOID<span className="text-lime">.OS</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="hidden text-[11px] tracking-wide text-muted transition-colors hover:text-lime sm:inline"
          >
            ← map
          </Link>
          <AccountMenu />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-4 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">personal ledger</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            your <span className="text-lime">lots</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            signed as <span className="text-lime">{who}</span>
            {ownerships.length
              ? ` · ${ownerships.length} constellation${ownerships.length === 1 ? '' : 's'} bound to this mind`
              : ' · no claims yet — open the full map and burn $EXO'}
          </p>
        </motion.div>

        {loading ? (
          <p className="mt-16 text-sm text-muted">loading ledger…</p>
        ) : !ownerships.length ? (
          <div className="mt-14 border border-lime/25 bg-black/40 p-8 sm:p-12">
            <div className="mx-auto h-40 max-w-sm opacity-70">
              <LotFigure
                lot={{ constel_id: 'empty_preview', constel_name: 'VACANT FIELD' }}
                animate
              />
            </div>
            <p className="mt-6 text-center text-sm text-muted">
              the ledger is empty. claim constellation lots on the live map — they appear here,
              drawn and readable, tied to your account.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/"
                className="bg-lime px-5 py-2.5 text-[11px] font-semibold tracking-wide text-black"
              >
                open map
              </Link>
              <Link
                to="/docs"
                className="border border-white/20 px-5 py-2.5 text-[11px] tracking-wide text-muted hover:border-lime/40 hover:text-lime"
              >
                read docs
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {profiles.map(({ lot, profile }, i) => {
                const on = active?.lot.constel_id === lot.constel_id
                return (
                  <motion.button
                    key={lot.constel_id}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedId(lot.constel_id)}
                    className={`group border text-left transition-colors ${
                      on
                        ? 'border-lime/60 bg-lime/10'
                        : 'border-white/10 bg-black/35 hover:border-lime/35'
                    }`}
                  >
                    <div className="h-28 border-b border-white/5 sm:h-32">
                      <LotFigure lot={lot} animate={on} />
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-lime">✧ {profile.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted">
                          {profile.band}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                        {profile.trait} · {profile.starCount} stars · mass {profile.mass}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence mode="wait">
              {active && (
                <motion.article
                  key={active.lot.constel_id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.35 }}
                  className="border border-lime/30 bg-black/50"
                >
                  <div className="relative h-56 border-b border-lime/15 sm:h-72">
                    <LotFigure lot={active.lot} animate />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-16">
                      <h2 className="font-display text-2xl font-extrabold tracking-tight text-lime sm:text-3xl">
                        {active.profile.name}
                      </h2>
                      <p className="mt-1 text-[11px] text-muted">
                        claimed {active.profile.claimedLabel} · id {active.profile.id}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 sm:p-7">
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">
                      <span className="border border-lime/30 px-2 py-1 text-lime">
                        {active.profile.trait}
                      </span>
                      <span className="border border-white/15 px-2 py-1 text-muted">
                        {active.profile.band}
                      </span>
                      <span className="border border-white/15 px-2 py-1 text-muted">
                        {active.profile.starCount} stars
                      </span>
                      <span className="border border-white/15 px-2 py-1 text-muted">
                        mass {active.profile.mass}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed text-ink/90">{active.profile.blurb}</p>

                    {active.profile.body.map((para, idx) => (
                      <p key={idx} className="text-sm leading-relaxed text-muted">
                        {para}
                      </p>
                    ))}

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Link
                        to="/"
                        className="bg-lime px-4 py-2 text-[11px] font-semibold tracking-wide text-black"
                        onClick={() => {
                          sessionStorage.setItem('void_focus_lot', active.lot.constel_id)
                        }}
                      >
                        view on map
                      </Link>
                      <button
                        type="button"
                        className="border border-lime/40 px-4 py-2 text-[11px] tracking-wide text-lime"
                        onClick={() => window.__openMindChat?.()}
                      >
                        ask the mind about this
                      </button>
                    </div>
                  </div>
                </motion.article>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <MindChat />
    </div>
  )
}
