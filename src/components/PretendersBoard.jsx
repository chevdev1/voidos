import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadUser, mindMapOwnerships, peekMapOwnerships } from '../lib/mindClient'

function shortWallet(w) {
  const s = String(w || '')
  if (!s || s === 'unlinked') return 'unlinked'
  if (!/^0x[a-fA-F0-9]{40}$/i.test(s)) return s
  if (s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

function rankMark(i) {
  if (i === 0) return 'I'
  if (i === 1) return 'II'
  if (i === 2) return 'III'
  return String(i + 1).padStart(2, '0')
}

/**
 * Live pretenders board — who claimed the most constellation lots.
 */
export function PretendersBoard({ compact = false }) {
  const [leaders, setLeaders] = useState([])
  const [lots, setLots] = useState([])
  const [totals, setTotals] = useState(null)
  const [err, setErr] = useState('')
  const [me, setMe] = useState(() => (loadUser()?.wallet || '').toLowerCase())

  useEffect(() => {
    const onUser = (e) => setMe(String(e.detail?.wallet || '').toLowerCase())
    window.addEventListener('void-user', onUser)
    return () => window.removeEventListener('void-user', onUser)
  }, [])

  useEffect(() => {
    let cancelled = false
    const peek = peekMapOwnerships()
    if (peek?.leaders?.length || peek?.lots?.length) {
      setLeaders(peek.leaders || [])
      setLots(peek.lots || [])
      setTotals(peek.totals || null)
    }
    mindMapOwnerships({ force: true })
      .then((data) => {
        if (cancelled) return
        setLeaders(data.leaders || [])
        setLots(data.lots || [])
        setTotals(data.totals || null)
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'board failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxCount = Math.max(1, ...leaders.map((r) => Number(r.count) || 0))
  const claimed = Number(totals?.claimed) || lots.length || leaders.reduce((a, r) => a + (Number(r.count) || 0), 0)
  const totalLots = Number(totals?.total) || 200
  const list = compact ? leaders.slice(0, 20) : leaders
  const podium = leaders.slice(0, 3)
  const unnamedLots = lots.filter((l) => !/^0x[a-fA-F0-9]{40}$/i.test(String(l.wallet || '')))

  const podiumOrder = useMemo(() => podium.map((r, i) => ({ ...r, place: i })), [podium])

  return (
    <section className={compact ? '' : 'mt-2'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          who owns the <span className="text-lime">void</span>
        </h2>
        <p className="font-mono text-[12px] text-muted">
          claimed <span className="text-lime">{claimed}</span> / {totalLots}
        </p>
      </div>

      {err ? <p className="mt-4 text-[12px] text-red-400">{err}</p> : null}

      {podium.length > 0 ? (
        <div
          className={`mt-8 grid items-end gap-2 sm:gap-4 ${
            podium.length >= 3 ? 'grid-cols-3' : podium.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
          } mx-auto max-w-3xl`}
        >
          {podiumOrder.map((r) => {
            const h = 28 + Math.round((Number(r.count) / maxCount) * (r.place === 0 ? 88 : 56))
            const mine = String(r.wallet).toLowerCase() === me
            return (
              <div
                key={r.wallet}
                className={`flex flex-col items-center ${
                  podium.length >= 3
                    ? r.place === 0
                      ? 'order-2'
                      : r.place === 1
                        ? 'order-1'
                        : 'order-3'
                    : ''
                }`}
              >
                <p className="mb-2 font-mono text-[10px] text-lime">{rankMark(r.place)}</p>
                <div
                  className={`flex w-full flex-col justify-end border px-2 py-3 sm:px-3 ${
                    r.place === 0
                      ? 'border-lime bg-lime/15'
                      : mine
                        ? 'border-lime/50 bg-lime/10'
                        : 'border-white/15 bg-black/50'
                  }`}
                  style={{ minHeight: `${h}px` }}
                >
                  <p className="font-display text-lg text-lime sm:text-2xl">{r.count}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted sm:text-[11px]" title={r.wallet}>
                    {shortWallet(r.wallet)}
                    {mine ? ' · you' : ''}
                  </p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-wider text-muted">
                    {r.place === 0 ? 'apex' : r.place === 1 ? 'second' : 'third'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : !err ? (
        <div className="mt-8 border border-dashed border-lime/30 px-5 py-12 text-center">
          <p className="font-display text-xl text-lime">empty field</p>
          <p className="mt-2 text-[12px] text-muted">first wallet to claim a constellation takes rank I</p>
          <Link to="/map" className="mt-4 inline-block border border-lime bg-lime px-4 py-2 text-[11px] font-semibold text-black">
            claim on map
          </Link>
        </div>
      ) : null}

      {list.length > 0 ? (
        <>
          <p className="mb-4 text-center font-mono text-xs text-green-500/70">
            Top-ranking wallets receive core yield percentages and bonus token airdrops.
          </p>
          <div className="custom-scrollbar mt-6 max-h-80 overflow-y-auto border border-white/10">
            <ol>
              <li className="sticky top-0 grid grid-cols-[3rem_1fr_auto] border-b border-white/10 bg-void px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-muted">
                <span>rank</span>
                <span>wallet</span>
                <span>lots</span>
              </li>
              {list.map((r, idx) => {
                const place = idx
                const mine = String(r.wallet).toLowerCase() === me
                const w = Math.max(6, Math.round((Number(r.count) / maxCount) * 100))
                const rankCls =
                  place === 0
                    ? 'text-yellow-400'
                    : place === 1
                      ? 'text-gray-300'
                      : place === 2
                        ? 'text-amber-600'
                        : 'text-muted'
                return (
                  <li
                    key={r.wallet}
                    className={`relative grid grid-cols-[3rem_1fr_auto] items-center px-3 py-2.5 ${
                      mine ? 'bg-lime/10' : idx % 2 ? 'bg-white/[0.02]' : ''
                    } ${place < 3 ? 'border-l-2' : ''} ${
                      place === 0 ? 'border-yellow-400' : place === 1 ? 'border-gray-300' : place === 2 ? 'border-amber-600' : ''
                    }`}
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 bg-lime/10"
                      style={{ width: `${w}%` }}
                    />
                    <span className={`relative font-mono text-[11px] ${rankCls}`}>{rankMark(place)}</span>
                    <span className="relative truncate font-mono text-[12px]" title={r.wallet}>
                      {shortWallet(r.wallet)}
                      {mine ? <span className="text-lime"> · you</span> : ''}
                    </span>
                    <span className={`relative font-mono text-[12px] ${place < 3 ? rankCls : 'text-lime'}`}>
                      {r.count}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </>
      ) : null}

      {unnamedLots.length > 0 ? (
        <div className="mt-6 border border-white/10 px-3 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
            {unnamedLots.length} claimed lots · wallet unlinked
          </p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
            {unnamedLots.map((l) => l.constel_name || l.constel_id).join(' · ')}
          </p>
        </div>
      ) : null}

      {compact && leaders.length > 20 ? (
        <Link to="/board" className="mt-4 inline-block text-[11px] tracking-wide text-lime">
          full pretenders board →
        </Link>
      ) : (
        <p className="mt-4 text-[10px] text-muted">live from the map ledger · updates when lots are claimed</p>
      )}
    </section>
  )
}
