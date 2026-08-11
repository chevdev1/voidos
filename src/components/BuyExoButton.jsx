import { useMemo, useState } from 'react'
import { getDexUrl, getExoCa, openDexBuy, copyExoCa } from '../lib/buyExo'

/**
 * Real Buy $EXO control — Dex when VITE_DEX_URL is set, else copy CA / soon.
 */
export function BuyExoButton({
  className = '',
  filled = true,
  onFallback,
  label = 'Buy $EXO',
}) {
  const dex = useMemo(() => getDexUrl(), [])
  const ca = useMemo(() => getExoCa(), [])
  const [note, setNote] = useState('')

  async function onClick(e) {
    e.preventDefault()
    if (dex) {
      openDexBuy()
      return
    }
    if (ca) {
      const ok = await copyExoCa()
      setNote(ok ? 'CA copied' : 'copy failed')
      setTimeout(() => setNote(''), 1600)
      onFallback?.('ca')
      return
    }
    setNote('token TBA')
    setTimeout(() => setNote(''), 1600)
    onFallback?.('soon')
  }

  const base =
    filled
      ? 'inline-flex items-center justify-center rounded-full border border-lime bg-lime px-4 py-2 text-[11px] font-semibold tracking-wide text-black transition-all duration-200 ease-out hover:bg-[#d8ff33] hover:shadow-[0_0_24px_rgba(204,255,0,0.35)] active:scale-[0.98]'
      : 'inline-flex items-center justify-center rounded-full border border-lime/50 bg-lime/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-lime transition-all duration-200 ease-out hover:bg-lime hover:text-black'

  const title = dex
    ? 'Open Dex to buy $EXO'
    : ca
      ? 'Copy $EXO contract address'
      : 'Set VITE_DEX_URL or VITE_EXO_CA on Vercel when token is live'

  if (dex) {
    return (
      <a
        href={dex}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${className}`}
        title={title}
      >
        {label}
      </a>
    )
  }

  return (
    <span className="relative inline-flex max-w-full flex-col items-stretch">
      <button type="button" onClick={onClick} className={`${base} ${className}`} title={title}>
        {label}
      </button>
      {note ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-lime/40 bg-black/95 px-2 py-0.5 text-[9px] tracking-wide text-lime shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          {note}
        </span>
      ) : null}
    </span>
  )
}
