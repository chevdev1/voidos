import { useCallback, useEffect, useState } from 'react'
import bs58 from 'bs58'
import { mindWalletLink, mindWalletUnlink, mindWalletBalance, loadGuestKey } from '../lib/mindClient'

function getProvider() {
  if (typeof window === 'undefined') return null
  const s = window.solana
  if (s?.isPhantom) return s
  return window.phantom?.solana || null
}

/**
 * Phantom connect + signed link to account; shows SOL / $EXO balances.
 */
export function WalletPanel({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [balances, setBalances] = useState(null)

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

  async function connectAndLink() {
    setBusy(true)
    setErr('')
    try {
      const provider = getProvider()
      if (!provider) {
        setErr('install Phantom wallet')
        window.open('https://phantom.app/', '_blank', 'noopener')
        return
      }
      const resp = await provider.connect()
      const pubkey = resp.publicKey?.toString?.() || provider.publicKey?.toString?.()
      if (!pubkey) throw new Error('no pubkey')

      const guestKey = loadGuestKey()
      const ts = Date.now()
      const message = `VOID.OS link wallet\nguest:${guestKey}\nts:${ts}`
      const encoded = new TextEncoder().encode(message)
      const signed = await provider.signMessage(encoded, 'utf8')
      const signature = bs58.encode(signed.signature || signed)

      const data = await mindWalletLink({ pubkey, message, signature })
      onUser?.(data.user)
      await refreshBal(pubkey)
    } catch (e) {
      setErr(e.message || 'wallet failed')
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
            Solana / Phantom — link anytime. SOL shows live; $EXO stays mint TBA until the coin
            is connected. Claims work without burn for now.
          </p>
        </div>
        <div className="flex gap-2">
          {user?.wallet ? (
            <>
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
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={connectAndLink}
              className="bg-lime px-3 py-1.5 text-[11px] font-semibold tracking-wide text-black disabled:opacity-50"
            >
              {busy ? '…' : 'connect Phantom'}
            </button>
          )}
        </div>
      </div>

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
