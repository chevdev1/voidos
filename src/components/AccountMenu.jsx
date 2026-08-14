import { useEffect, useState } from 'react'
import { mindSession, loadUser, saveUser } from '../lib/mindClient'
import { WalletPanel } from './WalletPanel'

/**
 * Account panel — identity = linked wallet.
 * On phone: full-screen sheet so connect UI / WC is usable.
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

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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
        className="flex items-center gap-2 rounded-full border border-white/15 px-2.5 py-2 text-[10px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime sm:px-3 sm:text-[11px]"
        title={wallet || 'connect wallet'}
      >
        {short || 'wallet'}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="close overlay"
            className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm md:bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[220] max-h-[92dvh] overflow-y-auto border-t border-lime/40 bg-black/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-5 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:max-h-[min(80vh,36rem)] md:w-[22rem] md:border md:border-lime/40 md:pb-4 md:shadow-[0_0_40px_rgba(204,255,0,0.08)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-lime">
                {wallet ? 'wallet' : 'access'}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 min-w-10 text-[14px] text-muted hover:text-lime"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            {wallet ? (
              <div className="space-y-3">
                <div className="border border-white/10 bg-void/80 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">linked now</p>
                  <p className="mt-1 truncate font-mono text-sm text-lime">{short}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Already connected — open cabinet. Change wallet only if you need another address.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (window.__voidCosmos?.enterArena) window.__voidCosmos.enterArena()
                    else if (window.__openFullMap) window.__openFullMap()
                    else window.__voidCosmosPendingEnter = true
                  }}
                  className="block w-full border border-lime bg-lime px-3 py-3 text-center text-[11px] font-semibold tracking-[0.14em] text-black transition-colors hover:bg-[#d8ff33]"
                >
                  OPEN MAP / ЛК
                </button>
                <WalletPanel user={user} onUser={onUserChange} />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">
                    connect <span className="text-lime">wallet</span>
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Pick any wallet from the list, or use a Chrome extension.
                  </p>
                </div>
                <WalletPanel user={user} onUser={onUserChange} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
