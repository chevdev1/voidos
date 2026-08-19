import { useMemo, useState } from 'react'
import {
  getDexUrl,
  getGeckoUrl,
  getExoCa,
  openDexBuy,
  copyExoCa,
  shouldBuyInSameTab,
} from '../lib/buyExo'
import { isTrustInjected } from '../lib/rhWallets'

/**
 * Buy $TEST. On Trust / phone: pause the map and stay in this tab — Dex popups freeze Trust.
 */
export function BuyExoButton({
  className = '',
  filled = true,
  onFallback,
  label = 'Buy $TEST',
}) {
  const dex = useMemo(() => getDexUrl(), [])
  const gecko = useMemo(() => getGeckoUrl(), [])
  const ca = useMemo(() => getExoCa(), [])
  const [note, setNote] = useState('')
  const [sheet, setSheet] = useState(false)

  const base =
    filled
      ? 'inline-flex h-9 items-center justify-center rounded-full border-none bg-lime px-4 text-[11px] font-bold tracking-wide text-black shadow-[0_0_16px_rgba(204,255,0,.2)] transition-all duration-200 ease-out hover:bg-[#d8ff33] hover:shadow-[0_0_28px_rgba(204,255,0,.4)] active:scale-[0.97]'
      : 'inline-flex h-9 items-center justify-center rounded-full border-none bg-lime/10 px-4 text-[11px] font-semibold tracking-wide text-lime shadow-[0_0_10px_rgba(204,255,0,.06)] transition-all duration-200 ease-out hover:bg-lime/20 hover:shadow-[0_0_18px_rgba(204,255,0,.15)]'

  function flash(msg) {
    setNote(msg)
    setTimeout(() => setNote(''), 1800)
  }

  async function onCopy() {
    const ok = await copyExoCa()
    flash(ok ? 'CA copied — paste in Trust Swap' : 'copy failed')
    onFallback?.('ca')
  }

  function onClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!dex && !ca) {
      flash('token TBA')
      onFallback?.('soon')
      return
    }
    if (shouldBuyInSameTab()) {
      try {
        document.body.classList.add('wallet-ui-open')
      } catch {
        /* ignore */
      }
      setSheet(true)
      return
    }
    if (dex) {
      openDexBuy(dex)
      return
    }
    onCopy()
  }

  function closeSheet() {
    setSheet(false)
    try {
      document.body.classList.remove('wallet-ui-open')
    } catch {
      /* ignore */
    }
  }

  const inTrust = typeof window !== 'undefined' && isTrustInjected()

  return (
    <span className="relative inline-flex max-w-full flex-col items-stretch">
      <button type="button" onClick={onClick} className={`${base} ${className}`} title="Buy $TEST">
        {label}
      </button>
      {note ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-lime/40 bg-black/95 px-2 py-0.5 text-[9px] tracking-wide text-lime">
          {note}
        </span>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-[6400] flex items-end justify-center bg-black/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <div
            className="w-full max-w-sm border border-lime/40 bg-black p-4"
            role="dialog"
            aria-label="Buy $TEST"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-lime">buy $TEST</p>
              <button type="button" className="min-h-10 min-w-10 text-muted" onClick={closeSheet}>
                ✕
              </button>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              {inTrust
                ? 'Trust freezes if Dex opens in a popup. Copy the CA and swap on Robinhood Chain, or open Dex in this same tab.'
                : 'Copy the contract and swap on Robinhood Chain (4663). Dex opens in this tab so the map can pause first.'}
            </p>
            {ca ? (
              <p className="mt-3 break-all font-mono text-[11px] text-lime">{ca}</p>
            ) : null}
            <div className="mt-4 space-y-2">
              {ca ? (
                <button
                  type="button"
                  onClick={onCopy}
                  className="w-full border border-lime bg-lime px-3 py-3 text-[12px] font-semibold tracking-wide text-black"
                >
                  Copy CA
                </button>
              ) : null}
              {dex ? (
                <button
                  type="button"
                  onClick={() => openDexBuy(dex)}
                  className="w-full border border-lime/50 px-3 py-3 text-[12px] tracking-wide text-lime"
                >
                  Open Dex this tab
                </button>
              ) : null}
              {gecko ? (
                <button
                  type="button"
                  onClick={() => openDexBuy(gecko)}
                  className="w-full border border-white/20 px-3 py-3 text-[12px] tracking-wide text-muted"
                >
                  Open GeckoTerminal
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeSheet}
                className="w-full border border-white/15 px-3 py-2.5 text-[11px] text-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  )
}
