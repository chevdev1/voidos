import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  mindSession,
  mindRegister,
  mindLogin,
  loadGuestKey,
} from '../lib/mindClient'
import { GoogleSignIn } from './GoogleSignIn'

/**
 * Account panel — Google is full register/login; name+password is optional fallback.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function refresh() {
    const data = await mindSession()
    setUser(data.user || null)
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data =
        tab === 'register'
          ? await mindRegister(name, password)
          : await mindLogin(name, password)
      if (data.error) throw new Error(data.error)
      setUser(data.user || null)
      setPassword('')
      setOpen(false)
    } catch (err) {
      setError(err.message || 'failed')
    } finally {
      setBusy(false)
    }
  }

  const label =
    user?.displayName || user?.email || (user?.google ? 'google' : 'account')

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
        <div className="absolute right-0 top-full z-[60] mt-2 w-80 border border-lime/30 bg-void/95 p-3 shadow-xl backdrop-blur">
          {user?.registered ? (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-lime/90">
                signed in as <b>{user.displayName || user.email}</b>
                {user.google ? (
                  <span className="text-muted"> · google</span>
                ) : null}
              </p>
              {user.email ? (
                <p className="text-[10px] text-muted">{user.email}</p>
              ) : null}
              {user.wallet ? (
                <p className="text-[10px] text-muted">
                  wallet {user.wallet.slice(0, 4)}…{user.wallet.slice(-4)}
                </p>
              ) : (
                <p className="text-[10px] text-muted">link Robinhood in cabinet</p>
              )}
            </div>
          ) : (
            <div className="mb-3">
              <GoogleSignIn
                onDone={(data) => {
                  setUser(data.user || null)
                  setOpen(false)
                }}
              />
            </div>
          )}

          <Link
            to="/cabinet"
            onClick={() => setOpen(false)}
            className="mb-3 block border border-lime/35 bg-lime/10 px-2 py-1.5 text-center text-[11px] tracking-wide text-lime"
          >
            open cabinet / лк →
          </Link>

          {!user?.registered && (
            <>
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="mb-2 text-[10px] uppercase tracking-wider text-muted hover:text-lime"
              >
                {showPass ? 'hide name / password' : 'or name + password'}
              </button>

              {showPass && (
                <>
                  <div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-muted">
                    <button
                      type="button"
                      className={tab === 'login' ? 'text-lime' : ''}
                      onClick={() => setTab('login')}
                    >
                      login
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      className={tab === 'register' ? 'text-lime' : ''}
                      onClick={() => setTab('register')}
                    >
                      register
                    </button>
                  </div>
                  <form className="flex flex-col gap-2" onSubmit={submit}>
                    <input
                      className="border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-ink outline-none focus:border-lime/50"
                      placeholder="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="username"
                      required
                    />
                    <input
                      className="border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-ink outline-none focus:border-lime/50"
                      placeholder="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                      required
                    />
                    {error && <p className="text-[11px] text-red-400">{error}</p>}
                    <button
                      type="submit"
                      disabled={busy}
                      className="bg-lime/90 px-2 py-1.5 text-[11px] font-semibold tracking-wide text-black disabled:opacity-50"
                    >
                      {busy ? '…' : tab === 'register' ? 'create account' : 'enter'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {user?.registered && !user?.google && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <GoogleSignIn
                compact
                onDone={(data) => {
                  setUser(data.user || null)
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
