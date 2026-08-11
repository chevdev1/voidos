import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mindSession, loadUser, saveUser } from '../lib/mindClient'
import { WalletPanel } from './WalletPanel'

/**
 * Account panel — identity = Robinhood Wallet.
 * Cabinet link only appears after wallet is connected.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(() => loadUser())

  useEffect(() => {
    mindSession()
      .then((data) => {
        if (data.user) saveUser(data.user)
        setUser(data.user || null)
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    const onUser = (e) => setUser(e.detail || null)
    window.addEventListener('void-user', onUser)
    return () => window.removeEventListener('void-user', onUser)
  }, [])

  function onUserChange(next) {
    saveUser(next)
    setUser(next)
  }

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
        <div className="absolute right-0 top-full z-[60] mt-2 w-[20rem] border border-lime/40 bg-black/95 p-4 shadow-[0_0_40px_rgba(204,255,0,0.08)] backdrop-blur-md">
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
                  account = this wallet. cabinet unlocks after connect.
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
            <div className="space-y-3">
              <div>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">
                  connect <span className="text-lime">wallet</span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  cabinet appears only after Robinhood Wallet is linked.
                </p>
              </div>
              <WalletPanel user={user} onUser={onUserChange} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
