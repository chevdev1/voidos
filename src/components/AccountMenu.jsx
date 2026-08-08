import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  mindSession,
  mindRegister,
  mindLogin,
  loadGuestKey,
} from '../lib/mindClient'

/**
 * Compact account panel — guest usable immediately; optional name+password upgrade.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const label = user?.registered ? user.displayName : 'account'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/15 px-3 py-2 text-[11px] tracking-wide text-muted transition-colors hover:border-lime/50 hover:text-lime"
        title={loadGuestKey() ? `id ${loadGuestKey().slice(0, 10)}…` : 'account'}
      >
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-64 border border-lime/30 bg-void/95 p-3 shadow-xl backdrop-blur">
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

          {user?.registered ? (
            <p className="mb-2 text-xs text-lime/90">
              signed in as <b>{user.displayName}</b>
              <br />
              <span className="text-muted">claims & chat sync to your account</span>
            </p>
          ) : (
            <p className="mb-2 text-[11px] text-muted">
              visitor mode works now. register to keep lots & mind memory across devices.
            </p>
          )}

          <Link
            to="/cabinet"
            onClick={() => setOpen(false)}
            className="mb-2 block border border-lime/35 bg-lime/10 px-2 py-1.5 text-center text-[11px] tracking-wide text-lime"
          >
            open cabinet →
          </Link>

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
        </div>
      )}
    </div>
  )
}
