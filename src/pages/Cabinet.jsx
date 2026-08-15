import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { mindSession, loadOwnerships, loadUser, mindTrainLot, saveUser } from '../lib/mindClient'
import { isClaimLiveClient, burnTestOnChain } from '../lib/rhWallets'
import { formatClaimBurn } from '../../shared/rhChain.js'
import { LotFigure, buildLotProfile, LOT_KINDS } from '../components/LotFigure'
import { AccountMenu } from '../components/AccountMenu'
import { MindChat } from '../components/MindChat'
import { WalletPanel } from '../components/WalletPanel'
import { PretendersBoard } from '../components/PretendersBoard'

/**
 * Personal cabinet — owned constellation lots by kind, rotatable viewer + full lore.
 */
export default function Cabinet() {
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [user, setUser] = useState(() => loadUser())
  const [selectedId, setSelectedId] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedStar, setSelectedStar] = useState(null)
  const [trainNote, setTrainNote] = useState('')
  const [trainBusy, setTrainBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await mindSession()
        if (cancelled) return
        setOwnerships(data.ownerships || [])
        if (data.user) saveUser(data.user)
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

  useEffect(() => {
    const onUser = (e) => {
      setUser(e.detail || null)
      setOwnerships(loadOwnerships())
    }
    window.addEventListener('void-user', onUser)
    return () => window.removeEventListener('void-user', onUser)
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
    setSelectedStar(null)
  }, [selectedId])

  useEffect(() => {
    if (!filtered.length) return
    const still = filtered.some((p) => p.lot.constel_id === selectedId)
    if (!still) setSelectedId(filtered[0].lot.constel_id)
  }, [filtered, selectedId])

  function onUserChange(next) {
    saveUser(next)
    setUser(next)
    setOwnerships(loadOwnerships())
  }

  const who = user?.wallet
    ? `${user.wallet.slice(0, 6)}…${user.wallet.slice(-4)}`
    : 'wallet not linked'
  const activeStar =
    active && selectedStar != null ? active.profile.stars[selectedStar] : null

  function askMindAboutStar(star, lotName) {
    const q =
      star?.askHint ||
      `tell me the story of star ${star?.label} ${star?.name} in ${lotName}`
    sessionStorage.setItem('void_mind_prefill', q)
    window.__openMindChat?.()
  }

  function askMindAboutLot(profile) {
    const q = `tell me the living story of my lot ${profile.name} and its stars: ${profile.stars
      .map((s) => `${s.label} ${s.name}`)
      .join(', ')}`
    sessionStorage.setItem('void_mind_prefill', q)
    window.__openMindChat?.()
  }

  async function trainActiveLot() {
    if (!active?.lot?.constel_id || trainBusy) return
    if (active.lot.trained) {
      setTrainNote('already trained — map filter sees this patch as fed.')
      return
    }
    if (!user?.wallet) {
      setTrainNote('link wallet first, then train.')
      window.__openWalletMenu?.()
      return
    }
    setTrainBusy(true)
    setTrainNote(
      isClaimLiveClient()
        ? `confirm ${formatClaimBurn(1)} burn in wallet…`
        : 'training…',
    )
    try {
      let txHash
      if (isClaimLiveClient()) {
        const burned = await burnTestOnChain(1)
        txHash = burned.hash
        setTrainNote('burn landed · saving to ledger…')
      }
      const next = await mindTrainLot(active.lot.constel_id, { txHash })
      setOwnerships(next)
      setTrainNote(
        isClaimLiveClient()
          ? `trained — burned ${formatClaimBurn(1)}. Map trained count updates.`
          : 'trained — saved to ledger. Map trained count updates.',
      )
      setTimeout(() => setTrainNote(''), 4200)
    } catch (e) {
      setTrainNote(e?.message || 'train failed')
    } finally {
      setTrainBusy(false)
    }
  }

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
            to="/map"
            className="text-[11px] tracking-wide text-muted hover:text-lime"
          >
            map
          </Link>
          <Link to="/board" className="text-[11px] tracking-wide text-muted hover:text-lime">
            board
          </Link>
          <AccountMenu />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-4 sm:px-10">
        {loading ? (
          <p className="mt-16 text-sm text-muted">loading ledger…</p>
        ) : !user?.wallet ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-10 max-w-lg space-y-5"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">access locked</p>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                connect wallet to open <span className="text-lime">cabinet</span>
              </h1>
              <p className="mt-3 text-sm text-muted">
                Link once — cabinet, lots, and train stay with this Robinhood Chain wallet.
              </p>
            </div>
            <WalletPanel user={user} onUser={onUserChange} />
            <Link to="/" className="inline-block text-[11px] text-muted hover:text-lime">
              ← back to map
            </Link>
          </motion.div>
        ) : (
          <>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              personal ledger
            </p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            your <span className="text-lime">lots</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            wallet <span className="text-lime">{who}</span>
            {ownerships.length
              ? ` · ${ownerships.length} constellation${ownerships.length === 1 ? '' : 's'} · 6 kinds`
              : ' · no claims yet — open map and claim'}
          </p>
          <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted/90">
            Identity is your <span className="text-lime">Robinhood Wallet</span>. One lot = one
            owner (others see RESERVED). Claim burns $TEST per lot.
          </p>
        </motion.div>

        <div className="mt-8">
          <WalletPanel user={user} onUser={onUserChange} />
        </div>
        <PretendersBoard compact />

        {!ownerships.length ? (
          <div className="mt-14 border border-lime/25 bg-black/40 p-8 sm:p-12">
            <div className="mx-auto h-40 max-w-sm opacity-70">
              <LotFigure
                lot={{ constel_id: 'empty_preview', constel_name: 'VACANT FIELD' }}
                animate
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
                          <LotFigure lot={lot} animate={false} />
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm text-lime">✧ {profile.name}</span>
                            <span className="text-[10px] uppercase tracking-wider text-muted">
                              {lot.trained ? 'trained' : profile.kindLabel}
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
                      <LotFigure
                        lot={active.lot}
                        animate
                        interactive
                        autoSpin
                        showLabels
                        selectedStar={selectedStar}
                        onSelectStar={(i) => setSelectedStar(i)}
                      />
                      <div className="pointer-events-none absolute left-3 top-3 border border-white/10 bg-black/55 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">
                        drag · tap a star
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4 pt-12">
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

                      {activeStar && (
                        <div className="border border-lime/35 bg-lime/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-lime">
                            {activeStar.label} · {activeStar.name}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            role {activeStar.role} · heat {activeStar.heat}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-ink/90">
                            {activeStar.story}
                          </p>
                          <button
                            type="button"
                            className="mt-3 border border-lime/40 px-3 py-1.5 text-[11px] tracking-wide text-lime"
                            onClick={() => askMindAboutStar(activeStar, active.profile.name)}
                          >
                            ask mind about this star
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {active.profile.stars.map((s, i) => (
                          <button
                            key={s.name + i}
                            type="button"
                            onClick={() => setSelectedStar(i)}
                            className={`border px-2 py-1 text-[10px] tracking-wide ${
                              selectedStar === i
                                ? 'border-lime/60 bg-lime/15 text-lime'
                                : 'border-white/15 text-muted hover:border-lime/35 hover:text-lime'
                            }`}
                          >
                            {s.label} {s.name}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {active.profile.facts.map((f) => (
                          <div
                            key={f.label}
                            className="border border-white/10 bg-black/30 px-2.5 py-2"
                          >
                            <div className="text-[9px] uppercase tracking-[0.14em] text-muted">
                              {f.label}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] text-lime" title={f.value}>
                              {f.value}
                            </div>
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
                            sessionStorage.setItem('void_open_arena', '1')
                          }}
                        >
                          view on map
                        </Link>
                        <button
                          type="button"
                          className="border border-lime/40 px-4 py-2 text-[11px] tracking-wide text-lime disabled:opacity-50"
                          disabled={Boolean(active.lot.trained) || trainBusy}
                          onClick={trainActiveLot}
                        >
                          {active.lot.trained
                            ? 'trained ✓'
                            : trainBusy
                              ? 'training…'
                              : isClaimLiveClient()
                                ? `Train lot · burn ${formatClaimBurn(1)}`
                                : 'Train lot'}
                        </button>
                        <button
                          type="button"
                          className="border border-lime/40 px-4 py-2 text-[11px] tracking-wide text-lime"
                          onClick={() => askMindAboutLot(active.profile)}
                        >
                          ask the mind the lot story
                        </button>
                      </div>
                      {trainNote ? (
                        <p className="text-[11px] text-lime/90">{trainNote}</p>
                      ) : (
                        <p className="text-[10px] text-muted">
                          training burns {formatClaimBurn(1)} to dead, then marks the lot as fed.
                        </p>
                      )}
                    </div>
                  </motion.article>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
          </>
        )}
      </main>

      <MindChat />
    </div>
  )
}
