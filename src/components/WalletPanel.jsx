import { useCallback, useEffect, useMemo, useState } from 'react'
import { mindWalletLink, mindWalletUnlink, mindWalletBalance, loadGuestKey } from '../lib/mindClient'
import { connectAndSignLink, hasWalletConnectProject, getInjectedEvm, abortWalletConnect } from '../lib/rhWallets'

/**
 * Single connect CTA — WalletConnect QR when configured, else browser wallet.
 */
export function WalletPanel({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [balances, setBalances] = useState(null)
  const [hasBrowser, setHasBrowser] = useState(false)

  useEffect(() => {
    const refresh = () => setHasBrowser(Boolean(getInjectedEvm()))
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
  const canConnect = wcReady || hasBrowser
  const connectMode = wcReady ? 'qr' : 'injected'
  const connectHint = wcReady
    ? 'Scan with Trust or any WalletConnect wallet'
    : hasBrowser
      ? 'Opens your browser wallet'
      : 'WalletConnect Project ID required'

  async function cancelConnect() {
    await abortWalletConnect()
    setBusy(false)
    setErr('connection cancelled — tap Connect wallet to try again')
  }

  async function linkWallet() {
    if (!canConnect || busy) return
    setBusy(true)
    setErr('')
    try {
      const guestKey = loadGuestKey()
      const ts = Date.now()
      const message = `VOID.OS link wallet\nguest:${guestKey}\nts:${ts}`
      const { pubkey, signature } = await connectAndSignLink(message, { mode: connectMode })
      const data = await mindWalletLink({ pubkey, message, signature })
      onUser?.(data.user)
      await refreshBal(pubkey)
    } catch (e) {
      const msg = e?.message || String(e)
      if (/reject|cancel|closed|denied|User closed/i.test(msg)) {
        setErr('connection cancelled — tap Connect wallet to try again')
      } else if (/already pending|already in progress/i.test(msg)) {
        setErr(msg)
      } else if (/timed out/i.test(msg)) {
        setErr(msg)
      } else setErr(msg || 'wallet failed')
      await abortWalletConnect()
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
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">wallet</p>
        <span className="border border-white/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted">
          robinhood chain
        </span>
      </div>

      <p className="mt-2 font-display text-2xl tracking-wide text-lime sm:text-3xl">
        {short || 'not linked'}
      </p>

      {!user?.wallet && (
        <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted">
          One tap to link. Works with <span className="text-lime/90">Trust</span>, MetaMask, and
          other WalletConnect wallets. Cabinet, lots, and train stay with this address.
        </p>
      )}

      {user?.wallet ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => refreshBal(user.wallet)}
            className="border border-white/20 px-3 py-2 text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
          >
            refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={unlink}
            className="border border-white/20 px-3 py-2 text-[11px] text-muted transition hover:border-red-400/50 hover:text-red-300"
          >
            unlink
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={busy || !canConnect}
            onClick={linkWallet}
            title={connectHint}
            className="group relative w-full overflow-hidden border border-lime/60 bg-lime px-4 py-3.5 text-left transition enabled:hover:shadow-[0_0_28px_rgba(204,255,0,0.35)] enabled:active:translate-y-px disabled:cursor-wait disabled:opacity-80"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition group-hover:opacity-100" />
            <span className="relative flex items-center justify-between gap-3">
              <span>
                <span className="block text-[13px] font-semibold tracking-[0.14em] text-black uppercase">
                  {busy ? 'Waiting for wallet…' : 'Connect wallet'}
                </span>
                <span className="mt-0.5 block text-[10px] tracking-wide text-black/65">
                  {busy
                    ? 'QR should open — scan with Trust'
                    : wcReady
                      ? 'QR · Trust · WalletConnect'
                      : 'Browser wallet'}
                </span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-black/25 text-black">
                {busy ? (
                  <span className="text-sm">…</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="square"
                    />
                  </svg>
                )}
              </span>
            </span>
          </button>
          {busy && (
            <button
              type="button"
              onClick={cancelConnect}
              className="w-full border border-white/25 px-3 py-2 text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {!user?.wallet && !canConnect && (
        <p className="mt-3 text-[11px] text-amber-200/90">
          Needs <code className="text-lime">VITE_WALLETCONNECT_PROJECT_ID</code> from{' '}
          <a
            className="underline hover:text-lime"
            href="https://cloud.reown.com/"
            target="_blank"
            rel="noreferrer"
          >
            cloud.reown.com
          </a>{' '}
          on Vercel + Redeploy.
        </p>
      )}

      {err && <p className="mt-3 text-[11px] text-red-400">{err}</p>}

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
