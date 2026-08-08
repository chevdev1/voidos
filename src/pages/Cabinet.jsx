import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { mindSession, loadOwnerships, loadUser } from '../lib/mindClient'
import { LotFigure, buildLotProfile, LOT_KINDS } from '../components/LotFigure'
import { AccountMenu } from '../components/AccountMenu'
import { MindChat } from '../components/MindChat'
import { WalletPanel } from '../components/WalletPanel'
import { GoogleSignIn } from '../components/GoogleSignIn'

/**
 * Personal cabinet — owned constellation lots by kind, rotatable viewer + full lore.
 */
export default function Cabinet() {
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [user, setUser] = useState(() => loadUser())
  const [selectedId, setSelectedId] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
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

  const kindCounts = useMemo(() => {
    const m = Object.fromEntries(LOT_KINDS.map((k) => [k.id, 0]))
    for (const { profile } of profiles) m[profile.kindId] = (m[profile.kindId] || 0) + 1
    return m
  }, [profiles])

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return profiles
    return profiles.filter((p) => p.profile.kindId === kindFilter)
  }, [profiles, kindFilter])

  const active =
    filtered.find((p) => p.lot.constel_id === selectedId) ||
    profiles.find((p) => p.lot.constel_id === selectedId) ||
    filtered[0] ||
    null

  useEffect(() => {
    if (!filtered.length) return
    const still = filtered.some((p) => p.lot.constel_id === selectedId)
    if (!still) setSelectedId(filtered[0].lot.constel_id)
  }, [filtered, selectedId])

  const who = user?.displayName || user?.email || (user?.google ? 'google' : 'visitor')

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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              personal ledger · лк
            </p>
            <span className="border border-lime/35 bg-lime/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-lime">
              test mode
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            your <span className="text-lime">lots</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            signed as <span className="text-lime">{who}</span>
            {user?.email ? <span className="text-muted"> · {user.email}</span> : null}
            {ownerships.length
              ? ` · ${ownerships.length} constellation${ownerships.length === 1 ? '' : 's'} · 6 kinds`
              : ' · no claims yet — open the map and claim (free while $EXO mint is off)'}
          </p>
          <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted/90">
            $EXO not live yet — claims, Google login, Robinhood link and lot viewer all work in{' '}
            <span className="text-lime">test</span>. No real burn. When mint is set, burns become
            real.
          </p>
        </motion.div>

        <div className="mt-8 space-y-4">
          {!user?.google && (
            <div className="border border-white/10 bg-black/40 p-4">
              <GoogleSignIn
                onDone={(data) => {
                  setUser(data.user || null)
                  if (data.ownerships) setOwnerships(data.ownerships)
                }}
              />
            </div>
          )}
          <WalletPanel user={user} onUser={setUser} />
        </div>

        {loading ? (
          <p className="mt-16 text-sm text-muted">loading ledger…</p>
        ) : !ownerships.length ? (
          <div className="mt-14 border border-lime/25 bg-black/40 p-8 sm:p-12">
            <div className="mx-auto h-40 max-w-sm opacity-70">
              <LotFigure
                lot={{ constel_id: 'empty_preview', constel_name: 'VACANT FIELD' }}
                animate
                interactive
              />
            </div>
            <p className="mt-6 text-center text-sm text-muted">
              the ledger is empty. claim constellation lots on the live map — six kinds (Spire,
              Coil, Crown, Lattice, Vein, Halo). after claim, open a lot here, drag to rotate, read
              full info.
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
          <>
            <div className="mt-10 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKindFilter('all')}
                className={`border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  kindFilter === 'all'
                    ? 'border-lime/50 bg-lime/15 text-lime'
                    : 'border-white/15 text-muted hover:border-lime/30 hover:text-lime'
                }`}
              >
                all · {profiles.length}
              </button>
              {LOT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKindFilter(k.id)}
                  className={`border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
                    kindFilter === k.id
                      ? 'border-lime/50 bg-lime/15 text-lime'
                      : 'border-white/15 text-muted hover:border-lime/30 hover:text-lime'
                  }`}
                >
                  {k.label}
                  {kindCounts[k.id] ? ` · ${kindCounts[k.id]}` : ''}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted">no lots of this kind yet.</p>
                ) : (
                  filtered.map(({ lot, profile }, i) => {
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
                              {profile.kindLabel}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                            {profile.kindTag} · {profile.trait} · {profile.starCount} stars
                          </p>
                        </div>
                      </motion.button>
                    )
                  })
                )}
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
                    <div className="relative h-64 border-b border-lime/15 sm:h-80">
                      <LotFigure lot={active.lot} animate interactive autoSpin />
                      <div className="pointer-events-none absolute left-3 top-3 border border-white/10 bg-black/55 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">
                        drag to rotate
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-4 pt-20">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-lime/80">
                          {active.profile.kindLabel} · {active.profile.rarity}
                        </p>
                        <h2 className="font-display text-2xl font-extrabold tracking-tight text-lime sm:text-3xl">
                          {active.profile.name}
                        </h2>
                        <p className="mt-1 text-[11px] text-muted">
                          claimed {active.profile.claimedLabel} · id {active.profile.id}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 p-5 sm:p-7">
                      <p className="text-[12px] leading-relaxed text-muted">
                        {active.profile.kindBlurb}
                      </p>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {active.profile.facts.map((f) => (
                          <div
                            key={f.label}
                            className="border border-white/10 bg-black/30 px-2.5 py-2"
                          >
                            <div className="text-[9px] uppercase tracking-[0.14em] text-muted">
                              {f.label}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] text-lime">{f.value}</div>
                          </div>
                        ))}
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
          </>
        )}
      </main>

      <MindChat />
    </div>
  )
}
