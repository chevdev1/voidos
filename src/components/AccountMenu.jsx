import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mindSession } from '../lib/mindClient'

/**
 * Account panel — identity = Robinhood Wallet (no Google).
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    mindSession()
      .then((data) => setUser(data.user || null))
      .catch(() => {})
  }, [open])

  const wallet = user?.wallet || null
  const short = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime"
        title={wallet || 'connect Robinhood Wallet'}
      >
        {short || 'wallet'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[19rem] border border-lime/40 bg-black/95 p-4 shadow-[0_0_40px_rgba(204,255,0,0.08)] backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-lime">
              {wallet ? 'wallet' : 'access'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted hover:text-lime"
              aria-label="close"
            >
              ✕
            </button>
          </div>

          {wallet ? (
            <div className="space-y-3">
              <div className="border border-white/10 bg-void/80 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted">robinhood chain</p>
                <p className="mt-1 truncate font-mono text-sm text-lime">{short}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  your account is this wallet — lots, claim, mind ledger follow it.
                </p>
              </div>
              <Link
                to="/cabinet"
                onClick={() => setOpen(false)}
                className="block border border-lime bg-lime px-3 py-2.5 text-center text-[11px] font-semibold tracking-[0.14em] text-black transition-colors hover:bg-[#d8ff33]"
              >
                OPEN CABINET / ЛК
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">
                  enter via <span className="text-lime">wallet</span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  no Google — connect Robinhood Wallet (QR or in-app). Then claim on the map.
                </p>
              </div>
              <Link
                to="/cabinet"
                onClick={() => setOpen(false)}
                className="block border border-lime bg-lime px-3 py-2.5 text-center text-[11px] font-semibold tracking-[0.14em] text-black transition-colors hover:bg-[#d8ff33]"
              >
                CONNECT IN CABINET →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
