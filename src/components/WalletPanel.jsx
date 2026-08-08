import { useCallback, useEffect, useMemo, useState } from 'react'
import { mindWalletLink, mindWalletUnlink, mindWalletBalance, loadGuestKey } from '../lib/mindClient'
import {
  listInjectedSolana,
  connectAndSignLink,
  hasWalletConnectProject,
} from '../lib/solanaWallets'

/**
 * Phantom / injected + Robinhood via WalletConnect; shows SOL / $EXO balances.
 */
export function WalletPanel({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [balances, setBalances] = useState(null)
  const [injected, setInjected] = useState([])

  useEffect(() => {
    const refresh = () => setInjected(listInjectedSolana())
    refresh()
    window.addEventListener('solana#initialized', refresh)
    const t = setTimeout(refresh, 800)
    return () => {
      window.removeEventListener('solana#initialized', refresh)
      clearTimeout(t)
    }
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

  async function linkWith(source) {
    setBusy(true)
    setErr('')
    try {
      const guestKey = loadGuestKey()
      const ts = Date.now()
      const message = `VOID.OS link wallet\nguest:${guestKey}\nts:${ts}`
      const { pubkey, signature } = await connectAndSignLink(source, message)
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
    ? `${user.wallet.slice(0, 4)}…${user.wallet.slice(-4)}`
    : null

  return (
    <div className="border border-lime/25 bg-black/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">wallet</p>
            <span className="border border-white/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted">
              test ok
            </span>
          </div>
          <p className="mt-1 text-sm text-lime">{short || 'not linked'}</p>
          <p className="mt-1 text-[11px] text-muted">
            Phantom (extension) or Robinhood Wallet (WalletConnect QR / in-app browser). SOL live;
            $EXO mint TBA until coin is set.
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
        ) : null}
      </div>

      {!user?.wallet && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !wcReady}
            onClick={() => linkWith('robinhood')}
            className="bg-lime px-3 py-1.5 text-[11px] font-semibold tracking-wide text-black disabled:opacity-50"
            title={
              wcReady
                ? 'Scan QR in Robinhood Wallet'
                : 'Add VITE_WALLETCONNECT_PROJECT_ID in env'
            }
          >
            {busy ? '…' : 'connect Robinhood'}
          </button>
          {injected.map((w) => (
            <button
              key={w.id + w.label}
              type="button"
              disabled={busy}
              onClick={() => linkWith(w)}
              className="border border-lime/40 px-3 py-1.5 text-[11px] tracking-wide text-lime disabled:opacity-50"
            >
              {busy ? '…' : `connect ${w.label}`}
            </button>
          ))}
          {!injected.some((w) => w.id === 'phantom') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!listInjectedSolana().some((w) => w.id === 'phantom')) {
                  window.open('https://phantom.app/', '_blank', 'noopener')
                  setErr('install Phantom, then refresh — or use Robinhood QR')
                  return
                }
                linkWith('phantom')
              }}
              className="border border-white/20 px-3 py-1.5 text-[11px] text-muted hover:border-lime/40 hover:text-lime"
            >
              Phantom
            </button>
          )}
        </div>
      )}

      {!user?.wallet && !wcReady && (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Robinhood QR needs <code className="text-lime">VITE_WALLETCONNECT_PROJECT_ID</code> from{' '}
          <a
            className="underline hover:text-lime"
            href="https://cloud.reown.com/"
            target="_blank"
            rel="noreferrer"
          >
            cloud.reown.com
          </a>
          . Or open this site inside Robinhood Wallet → Web3 browser and use the injected connect
          button.
        </p>
      )}

      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}

      {user?.wallet && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="border border-white/10 bg-void/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">SOL</p>
            <p className="mt-1 font-display text-xl text-ink">
              {balances?.sol == null ? '—' : balances.sol}
            </p>
          </div>
          <div className="border border-white/10 bg-void/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">$EXO</p>
            <p className="mt-1 font-display text-xl text-lime">
              {balances?.exo == null
                ? balances?.exoMint
                  ? '0'
                  : 'mint TBA'
                : balances.exo}
            </p>
          </div>
          <div className="border border-white/10 bg-void/60 p-3 sm:col-span-1 col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">network</p>
            <p className="mt-1 text-sm text-muted">{balances?.rpc || 'mainnet'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
