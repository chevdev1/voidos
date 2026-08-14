import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadUser, mindMapOwnerships } from '../lib/mindClient'

function shortWallet(w) {
  const s = String(w || '')
  if (s.length < 12) return s || '—'
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

/**
 * Public pretenders board — wallets ranked by claimed constellations.
 */
export function PretendersBoard({ compact = false }) {
  const [leaders, setLeaders] = useState([])
  const [totals, setTotals] = useState(null)
  const [err, setErr] = useState('')
  const me = (loadUser()?.wallet || '').toLowerCase()

  useEffect(() => {
    let cancelled = false
    mindMapOwnerships({ force: true })
      .then((data) => {
        if (cancelled) return
        setLeaders(data.leaders || [])
        setTotals(data.totals || null)
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'board failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = compact ? leaders.slice(0, 8) : leaders
  const youRank = leaders.findIndex((r) => String(r.wallet).toLowerCase() === me) + 1

  return (
    <section className={compact ? '' : 'mt-8'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">pretenders</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            who claimed the most <span className="text-lime">constellations</span>
          </h2>
          <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-muted">
            Ranked by lots on the live ledger. Same board on phone and PC. Your cabinet follows
            this wallet only — switch wallet, switch cabinet.
          </p>
        </div>
        {totals ? (
          <p className="text-[11px] text-muted">
            claimed <span className="text-lime">{totals.claimed}</span> / {totals.total}
          </p>
        ) : null}
      </div>

      {youRank > 0 ? (
        <p className="mt-3 text-[12px] text-lime">
          this wallet · rank #{youRank} · {leaders[youRank - 1]?.count} lots
        </p>
      ) : me ? (
        <p className="mt-3 text-[12px] text-muted">this wallet has no claimed lots yet</p>
      ) : (
        <p className="mt-3 text-[12px] text-muted">connect wallet to see your rank</p>
      )}

      {err ? <p className="mt-4 text-[12px] text-red-400">{err}</p> : null}

      <div className="mt-4 overflow-x-auto border border-lime/25">
        <table className="w-full min-w-[18rem] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-muted">
              <th className="px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">wallet</th>
              <th className="px-3 py-2 font-normal">constellations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const mine = String(r.wallet).toLowerCase() === me
              return (
                <tr
                  key={r.wallet}
                  className={`border-b border-white/5 ${mine ? 'bg-lime/10 text-lime' : 'text-ink'}`}
                >
                  <td className="px-3 py-2.5 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-mono" title={r.wallet}>
                    {shortWallet(r.wallet)}
                    {mine ? ' · you' : ''}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-lime">{r.count}</td>
                </tr>
              )
            })}
            {!rows.length && !err ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted">
                  no claims on the ledger yet — first wallet to claim becomes #1
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {compact ? (
        <Link to="/board" className="mt-3 inline-block text-[11px] text-lime hover:underline">
          full board →
        </Link>
      ) : null}
    </section>
  )
}
