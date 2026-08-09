import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mindSession, loadGuestKey } from '../lib/mindClient'
import { GoogleSignIn } from './GoogleSignIn'

/**
 * Account panel — Google only (register = login).
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    mindSession()
      .then((data) => setUser(data.user || null))
      .catch(() => {})
  }, [])

  const signed = Boolean(user?.registered || user?.google)
  const label = signed
    ? user?.displayName || user?.email || 'account'
    : 'account'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime"
        title={loadGuestKey() ? `id ${loadGuestKey().slice(0, 10)}…` : 'account'}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
        ) : null}
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[19rem] border border-lime/40 bg-black/95 p-4 shadow-[0_0_40px_rgba(204,255,0,0.08)] backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-lime">
              {signed ? 'session' : 'access'}
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

          {signed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 border border-white/10 bg-void/80 p-3">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full border border-lime/30"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center border border-lime/40 text-[11px] text-lime">
                    ◆
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-lime">
                    {user?.displayName || user?.email}
                  </p>
                  <p className="truncate text-[10px] text-muted">
                    {user?.email || 'google account'}
                    {user?.wallet
                      ? ` · ${user.wallet.slice(0, 4)}…${user.wallet.slice(-4)}`
                      : ''}
                  </p>
                </div>
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
                  enter via <span className="text-lime">google</span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  one click — register and login. lots, wallet, mind memory stay on this
                  account.
                </p>
              </div>

              <GoogleSignIn
                onDone={(data) => {
                  setUser(data.user || null)
                  setOpen(false)
                }}
              />

              <Link
                to="/cabinet"
                onClick={() => setOpen(false)}
                className="block text-center text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-lime"
              >
                cabinet as visitor →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
