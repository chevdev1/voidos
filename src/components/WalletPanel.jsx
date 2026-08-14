import { useCallback, useEffect, useMemo, useState } from 'react'
import { mindWalletLink, mindWalletUnlink, mindWalletBalance, loadGuestKey, mindSession } from '../lib/mindClient'
import {
  connectAndSignLink,
  hasWalletConnectProject,
  getInjectedEvm,
  abortWalletConnect,
  prefetchWalletConnect,
  isMobileDevice,
  isTrustInjected,
  openSiteInTrustWallet,
} from '../lib/rhWallets'

function injectedLabel() {
  const eth = typeof window !== 'undefined' ? window.ethereum : null
  if (!eth) return 'Browser extension'
  if (eth.isTrust || eth.isTrustWallet) return 'Trust'
  if (eth.isMetaMask) return 'MetaMask'
  if (eth.isRobinhood || eth.isRobinhoodWallet) return 'Robinhood'
  return 'Browser wallet'
}

/**
 * Connect when unlinked. When linked: status + optional Change wallet (collapsed).
 */
export function WalletPanel({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [busyMode, setBusyMode] = useState(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [balances, setBalances] = useState(null)
  const [hasBrowser, setHasBrowser] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [inTrust, setInTrust] = useState(false)
  const [extName, setExtName] = useState('Browser wallet')
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setHasBrowser(Boolean(getInjectedEvm()))
      setMobile(isMobileDevice())
      setInTrust(isTrustInjected())
      setExtName(injectedLabel())
    }
    refresh()
    prefetchWalletConnect()
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

  // Linked = done. Keep the live WC/injected session so claim can sign without reconnecting.
  useEffect(() => {
    if (!user?.wallet) return
    setChanging(false)
    setBusy(false)
    setBusyMode(null)
  }, [user?.wallet])

  const wcReady = useMemo(() => hasWalletConnectProject(), [])
  const canConnect = wcReady || hasBrowser
  const showOpenInTrust = mobile && !inTrust && !hasBrowser
  const linked = Boolean(user?.wallet)
  const showConnect = !linked || changing

  async function cancelConnect() {
    await abortWalletConnect()
    setBusy(false)
    setBusyMode(null)
    setErr('Cancelled')
    if (linked) setChanging(false)
  }

  async function linkWallet(mode) {
    if (!canConnect || busy) return
    if (mode === 'injected' && !hasBrowser) {
      setErr('Install MetaMask / Trust extension in Chrome, then refresh')
      return
    }
    if (mode === 'qr' && !wcReady) {
      setErr('WalletConnect Project ID missing on Vercel')
      return
    }
    setBusy(true)
    setBusyMode(mode)
    setErr('')
    setNote('')
    try {
      await abortWalletConnect()
      const session = await mindSession()
      const guestKey = String(session?.guestKey || loadGuestKey() || '').trim()
      if (!guestKey) throw new Error('Session not ready — refresh and try again')
      const ts = Date.now()
      const message = `VOID.OS link wallet\nguest:${guestKey}\nts:${ts}`
      const { pubkey, signature } = await connectAndSignLink(message, { mode })
      const prev = user?.wallet ? String(user.wallet).toLowerCase() : ''
      const next = String(pubkey).toLowerCase()
      const data = await mindWalletLink({ pubkey, message, signature })
      onUser?.(data.user)
      await refreshBal(pubkey)
      setChanging(false)
      if (prev && prev === next) {
        setNote('Already linked — you are connected')
      } else if (prev && prev !== next) {
        setNote(`Switched → ${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`)
      } else {
        setNote(`Linked ${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`)
      }
    } catch (e) {
      const msg = e?.message || String(e)
      if (/reject|cancel|closed|denied|User closed|reset/i.test(msg)) {
        setErr('Cancelled or reset — try again')
      } else if (/already pending|already in progress/i.test(msg)) {
        setErr(msg)
      } else if (/timed out/i.test(msg)) {
        setErr(msg)
      } else setErr(msg || 'wallet failed')
      await abortWalletConnect()
    } finally {
      setBusy(false)
      setBusyMode(null)
    }
  }

  async function unlink() {
    setBusy(true)
    setErr('')
    setNote('')
    try {
      await abortWalletConnect()
      const data = await mindWalletUnlink()
      onUser?.(data.user)
      setBalances(null)
      setChanging(false)
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
    <div className="border border-lime/25 bg-black p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">wallet</p>
        <span className="border border-white/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted">
          robinhood chain
        </span>
        {linked && (
          <span className="border border-lime/40 bg-lime/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-lime">
            connected
          </span>
        )}
      </div>

      <p className="mt-2 font-display text-2xl tracking-wide text-lime sm:text-3xl">
        {short || 'not linked'}
      </p>

      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted">
        {linked
          ? 'Linked on this device. Claim / cabinet use this address — no need to connect again.'
          : 'Open the full wallet list (Trust, MetaMask, Rainbow, Coinbase, …) via WalletConnect. Chrome extension works too.'}
      </p>

      {linked && (
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
          {!changing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setErr('')
                setNote('')
                setChanging(true)
              }}
              className="border border-white/20 px-3 py-2 text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
            >
              change wallet
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={cancelConnect}
              className="border border-white/20 px-3 py-2 text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
            >
              cancel change
            </button>
          )}
        </div>
      )}

      {showConnect && (
        <div className="mt-4 space-y-2">
          {linked && changing && (
            <p className="text-[11px] text-muted">
              Pick a new wallet — it replaces the current link after you sign.
            </p>
          )}
          {showOpenInTrust && (
            <button
              type="button"
              onClick={openSiteInTrustWallet}
              className="w-full border border-lime/50 bg-lime/10 px-4 py-3.5 text-left transition hover:bg-lime/20"
            >
              <span className="block text-[13px] font-semibold tracking-[0.14em] text-lime uppercase">
                Open in Trust
              </span>
              <span className="mt-0.5 block text-[10px] tracking-wide text-muted">
                Best on phone — then Connect inside Trust
              </span>
            </button>
          )}

          {wcReady && (
            <button
              type="button"
              disabled={busy}
              onClick={() => linkWallet('qr')}
              title="All WalletConnect wallets"
              className="group relative w-full overflow-hidden border border-lime/60 bg-lime px-4 py-3.5 text-left transition enabled:hover:shadow-[0_0_28px_rgba(204,255,0,0.35)] enabled:active:translate-y-px disabled:cursor-wait disabled:opacity-80"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition group-hover:opacity-100" />
              <span className="relative flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-semibold tracking-[0.14em] text-black uppercase">
                    {busy && busyMode === 'qr'
                      ? 'Waiting…'
                      : linked
                        ? 'Switch via WalletConnect'
                        : 'Connect wallet'}
                  </span>
                  <span className="mt-0.5 block text-[10px] tracking-wide text-black/65">
                    {busy && busyMode === 'qr'
                      ? mobile
                        ? 'Pick your wallet — approve in the app'
                        : 'QR or pick any wallet from the list'
                      : 'All wallets · Trust · MetaMask · Rainbow · QR'}
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-black/25 text-black">
                  {busy && busyMode === 'qr' ? '…' : '⧉'}
                </span>
              </span>
            </button>
          )}

          {hasBrowser && (
            <button
              type="button"
              disabled={busy}
              onClick={() => linkWallet('injected')}
              title={`Use installed ${extName}`}
              className="w-full border border-white/20 bg-black/30 px-4 py-3.5 text-left transition hover:border-lime/40 disabled:cursor-wait disabled:opacity-80"
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-semibold tracking-[0.14em] text-lime uppercase">
                    {busy && busyMode === 'injected'
                      ? 'Waiting…'
                      : linked
                        ? `Switch → ${extName}`
                        : `Use ${extName}`}
                  </span>
                  <span className="mt-0.5 block text-[10px] tracking-wide text-muted">
                    {busy && busyMode === 'injected'
                      ? 'Approve in the extension popup'
                      : 'Installed Chrome / Brave extension'}
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/25 text-lime">
                  {busy && busyMode === 'injected' ? '…' : '↗'}
                </span>
              </span>
            </button>
          )}

          {busy && (
            <button
              type="button"
              onClick={cancelConnect}
              className="w-full border border-white/25 px-3 py-2.5 text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {!linked && !canConnect && (
        <p className="mt-3 text-[11px] text-amber-200/90">
          Set <code className="text-lime">VITE_WALLETCONNECT_PROJECT_ID</code> on Vercel for the
          full wallet list, or install a browser extension.
        </p>
      )}

      {note && <p className="mt-3 text-[11px] text-lime">{note}</p>}
      {err && <p className="mt-3 text-[11px] text-red-400">{err}</p>}

      {linked && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="overflow-hidden rounded-md border border-gray-800 bg-black p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-gray-500">ETH</p>
            <p className="mt-1 truncate text-sm text-ink">
              {balances?.eth == null ? '—' : balances.eth}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border border-gray-800 bg-black p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-gray-500">$TEST</p>
            <p className="mt-1 truncate text-sm text-lime">
              {balances?.exo == null
                ? balances?.exoToken
                  ? '0'
                  : 'token TBA'
                : balances.exo}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border border-gray-800 bg-black p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-gray-500">network</p>
            <p className="mt-1 truncate text-sm text-muted">
              {balances?.network || 'Robinhood Chain'}
              {balances?.chainId ? ` · ${balances.chainId}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
