import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mindSession, loadGuestKey } from '../lib/mindClient'
import { GoogleSignIn } from './GoogleSignIn'

/**
 * Account panel — Google only (register = login). Mobile-safe sheet.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    mindSession()
      .then((data) => setUser(data.user || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const signed = Boolean(user?.registered || user?.google)
  const label = signed
    ? user?.displayName || user?.email || 'account'
    : 'account'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 min-h-11 max-w-[7.5rem] items-center gap-2 rounded-full border border-white/15 px-3 text-[11px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime sm:max-w-[10rem] sm:px-3.5"
        title={loadGuestKey() ? `id ${loadGuestKey().slice(0, 10)}…` : 'account'}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-4 w-4 shrink-0 rounded-full" />
        ) : null}
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="close account"
            className="fixed inset-0 z-[65] bg-black/55"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-3 z-[70] max-h-[min(85dvh,640px)] overflow-y-auto border border-lime/40 bg-black/95 p-4 shadow-[0_0_40px_rgba(204,255,0,0.08)] backdrop-blur-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(19rem,calc(100vw-1.5rem))] sm:max-h-none"
            style={{ top: 'calc(env(safe-area-inset-top) + 3.5rem)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-lime">
                {signed ? 'session' : 'access'}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center text-[14px] text-muted hover:text-lime"
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
                      className="h-9 w-9 shrink-0 rounded-full border border-lime/30"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-lime/40 text-[11px] text-lime">
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
                  className="flex min-h-11 items-center justify-center border border-lime bg-lime px-3 text-center text-[11px] font-semibold tracking-[0.14em] text-black transition-colors hover:bg-[#d8ff33]"
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
                  className="flex min-h-11 items-center justify-center text-center text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-lime"
                >
                  cabinet as visitor →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
