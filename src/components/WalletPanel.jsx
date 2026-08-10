import { useCallback, useEffect, useMemo, useState } from 'react'
import { mindWalletLink, mindWalletUnlink, mindWalletBalance, loadGuestKey } from '../lib/mindClient'
import { connectAndSignLink, hasWalletConnectProject, getRobinhoodInjected } from '../lib/rhWallets'

/**
 * Robinhood Chain wallet link (WalletConnect / in-app); shows ETH / $EXO balances.
 */
export function WalletPanel({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [balances, setBalances] = useState(null)
  const [inApp, setInApp] = useState(false)

  useEffect(() => {
    const refresh = () => setInApp(Boolean(getRobinhoodInjected()))
    refresh()
    const t = setTimeout(refresh, 800)
    return () => clearTimeout(t)
  }, [])

  const refreshBal = useCallback(async (pubkey) => {
    try {
      const data = await mindWalletBalance(pubkey)
      setBalances(data.balances || null)
    } catch {
      setBalances(null)
    }
  }, [])

  useEffect(() => {
    if (user?.wallet) refreshBal(user.wallet)
  }, [user?.wallet, refreshBal])

  const wcReady = useMemo(() => hasWalletConnectProject(), [])
  const canConnect = inApp || wcReady

  async function linkRobinhood() {
    setBusy(true)
    setErr('')
    try {
      const guestKey = loadGuestKey()
      const ts = Date.now()
      const message = `VOID.OS link wallet\nguest:${guestKey}\nts:${ts}`
      const { pubkey, signature } = await connectAndSignLink(message)
      const data = await mindWalletLink({ pubkey, message, signature })
      onUser?.(data.user)
      await refreshBal(pubkey)
    } catch (e) {
      const msg = e?.message || String(e)
      if (/reject|cancel|closed|denied/i.test(msg)) setErr('connection cancelled')
      else setErr(msg || 'wallet failed')
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    setBusy(true)
    setErr('')
    try {
      const data = await mindWalletUnlink()
      onUser?.(data.user)
      setBalances(null)
    } catch (e) {
      setErr(e.message || 'unlink failed')
    } finally {
      setBusy(false)
    }
  }

  const short = user?.wallet
    ? `${user.wallet.slice(0, 6)}…${user.wallet.slice(-4)}`
    : null

  return (
    <div className="border border-lime/25 bg-black/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">wallet</p>
            <span className="border border-white/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted">
              robinhood chain
            </span>
          </div>
          <p className="mt-1 text-sm text-lime">{short || 'not linked'}</p>
          <p className="mt-1 text-[11px] text-muted">
            Robinhood Wallet on Robinhood Chain — WalletConnect QR or in-app Web3. ETH live; $EXO
            when token address is set.
          </p>
        </div>
        {user?.wallet ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => refreshBal(user.wallet)}
              className="border border-white/20 px-3 py-1.5 text-[11px] text-muted hover:border-lime/40 hover:text-lime"
            >
              refresh
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={unlink}
              className="border border-white/20 px-3 py-1.5 text-[11px] text-muted hover:border-red-400/50 hover:text-red-300"
            >
              unlink
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !canConnect}
            onClick={linkRobinhood}
            className="bg-lime px-3 py-1.5 text-[11px] font-semibold tracking-wide text-black disabled:opacity-50"
            title={
              canConnect
                ? 'Connect Robinhood Wallet'
                : 'Add VITE_WALLETCONNECT_PROJECT_ID in env'
            }
          >
            {busy ? '…' : 'connect Robinhood'}
          </button>
        )}
      </div>

      {!user?.wallet && !canConnect && (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Needs <code className="text-lime">VITE_WALLETCONNECT_PROJECT_ID</code> from{' '}
          <a
            className="underline hover:text-lime"
            href="https://cloud.reown.com/"
            target="_blank"
            rel="noreferrer"
          >
            cloud.reown.com
          </a>
          , or open this site inside Robinhood Wallet → Web3 browser.
        </p>
      )}

      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}

      {user?.wallet && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="border border-white/10 bg-void/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">ETH</p>
            <p className="mt-1 font-display text-xl text-ink">
              {balances?.eth == null ? '—' : balances.eth}
            </p>
          </div>
          <div className="border border-white/10 bg-void/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">$EXO</p>
            <p className="mt-1 font-display text-xl text-lime">
              {balances?.exo == null
                ? balances?.exoToken
                  ? '0'
                  : 'token TBA'
                : balances.exo}
            </p>
          </div>
          <div className="border border-white/10 bg-void/60 p-3 sm:col-span-1 col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">network</p>
            <p className="mt-1 text-sm text-muted">
              {balances?.network || 'Robinhood Chain'}
              {balances?.chainId ? ` · ${balances.chainId}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
