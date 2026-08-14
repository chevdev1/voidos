import { useEffect, useState } from 'react'

const LINES = [
  'booting VOID.OS',
  'warming the probe',
  'charting 200 lots',
  'linking the mind',
]

/**
 * Full-screen boot gate — map + session load behind it, then fade out.
 */
export function BootSplash({ ready, onDone }) {
  const [line, setLine] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (ready) return undefined
    const t = setInterval(() => setLine((n) => (n + 1) % LINES.length), 900)
    return () => clearInterval(t)
  }, [ready])

  useEffect(() => {
    if (!ready || leaving || gone) return
    setLeaving(true)
    const t = setTimeout(() => {
      setGone(true)
      onDone?.()
    }, 520)
    return () => clearTimeout(t)
  }, [ready, leaving, gone, onDone])

  if (gone) return null

  return (
    <div
      className={`fixed inset-0 z-[400000] flex flex-col items-center justify-center bg-void px-6 transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full border border-lime/30" />
        <span className="absolute inset-2 animate-pulse rounded-full border border-lime/50" />
        <img src="/assets/void-logo.png" alt="" className="relative h-8 w-8" />
      </div>
      <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        VOID<span className="text-lime">.OS</span>
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.28em] text-lime">
        {LINES[line]}
      </p>
      <div className="mt-8 h-px w-40 overflow-hidden bg-white/10">
        <span className="boot-bar block h-full w-1/3 bg-lime" />
      </div>
    </div>
  )
}
