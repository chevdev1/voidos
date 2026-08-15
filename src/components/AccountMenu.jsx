import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mindSession, loadUser, saveUser } from '../lib/mindClient'
import { WalletPanel } from './WalletPanel'
import { abortWalletConnect, releaseMapUiLocks } from '../lib/rhWallets'

/**
 * Account panel — identity = linked wallet.
 * Phone: solid full-screen sheet (no blur / motion) so WalletConnect can be tapped.
 */
export function AccountMenu() {
  const navigate = useNavigate()
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
    window.__openWalletMenu = () => setOpen(true)
    return () => {
      if (window.__openWalletMenu) delete window.__openWalletMenu
    }
  }, [])

  useEffect(() => {
    if (!open) {
      releaseMapUiLocks()
      return
    }
    document.body.classList.add('wallet-ui-open')
    document.body.style.overflow = 'hidden'
    return () => {
      releaseMapUiLocks()
    }
  }, [open])

  function onUserChange(next) {
    saveUser(next)
    setUser(next)
  }

  function closeModal() {
    setOpen(false)
    abortWalletConnect()
    releaseMapUiLocks()
  }

  const wallet = user?.wallet || null
  const short = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null

  return (
    <div className="account-menu relative">
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
            className="account-menu-backdrop"
            onClick={closeModal}
          />
          <div className="account-menu-sheet" role="dialog" aria-modal="true">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-lime">
                {wallet ? 'wallet' : 'access'}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 min-w-11 text-[16px] text-muted hover:text-lime"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            {wallet ? (
              <div className="space-y-3">
                <div className="border border-white/10 bg-black p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">linked now</p>
                  <p className="mt-1 truncate font-mono text-sm text-lime">{short}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Already connected — open cabinet. Change wallet only if you need another address.
                  </p>
                </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal()
                      navigate('/map')
                    }}
                    className="block w-full border border-lime bg-lime px-3 py-3 text-center text-[11px] font-semibold tracking-[0.14em] text-black"
                  >
                    OPEN MAP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal()
                      navigate('/cabinet')
                    }}
                    className="block w-full border border-lime/50 px-3 py-3 text-center text-[11px] font-semibold tracking-[0.14em] text-lime"
                  >
                    CABINET
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal()
                      navigate('/board')
                    }}
                    className="block w-full border border-white/20 px-3 py-3 text-center text-[11px] tracking-[0.14em] text-muted"
                  >
                    PRETENDERS BOARD
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
                    On phone: Trust / MetaMask from the list, or open this site inside Trust Browser.
                  </p>
                </div>
                <WalletPanel user={user} onUser={onUserChange} />
                <button
                  type="button"
                  onClick={() => {
                    closeModal()
                    navigate('/cabinet')
                  }}
                  className="block w-full border border-white/20 px-3 py-3 text-center text-[11px] tracking-[0.14em] text-muted"
                >
                  CABINET
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeModal()
                    navigate('/board')
                  }}
                  className="block w-full border border-white/20 px-3 py-3 text-center text-[11px] tracking-[0.14em] text-muted"
                >
                  PRETENDERS BOARD
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
