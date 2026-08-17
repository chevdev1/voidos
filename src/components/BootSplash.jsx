import { useEffect, useState } from 'react'

function stageText(p) {
  if (p < 30) return 'INITIALIZING VOID.OS...'
  if (p < 60) return 'WARMING THE PROBE...'
  if (p < 90) return 'SYNCING SECTORS...'
  return 'ACCESS GRANTED.'
}

/**
 * Full-screen boot gate — map + session load behind it, then fade out.
 *
 * `progress` is a simulated ramp for feel, not a real loader — it's capped
 * at 92 until the `ready` prop flips true (the caller's actual "did the map
 * paint a real frame" signal), so the bar can never claim 100% while the
 * canvas underneath is still booting.
 */
export function BootSplash({ ready, onDone }) {
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState(stageText(0))
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(() => {
    try {
      return sessionStorage.getItem('void_boot') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (gone) onDone?.()
  }, [gone, onDone])

  useEffect(() => {
    if (ready) return undefined
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + Math.random() * 5 + 2, 92)
        setLoadingText(stageText(next))
        return next
      })
    }, 180)
    return () => clearInterval(t)
  }, [ready])

  useEffect(() => {
    if (!ready) return
    setProgress(100)
    setLoadingText(stageText(100))
  }, [ready])

  useEffect(() => {
    if (!ready || leaving || gone) return
    const t = setTimeout(() => setLeaving(true), 260)
    return () => clearTimeout(t)
  }, [ready, leaving, gone])

  useEffect(() => {
    if (!leaving || gone) return
    const t = setTimeout(() => {
      setGone(true)
      try {
        sessionStorage.setItem('void_boot', '1')
      } catch {
        /* ignore */
      }
      onDone?.()
    }, 180)
    return () => clearTimeout(t)
  }, [leaving, gone, onDone])

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
        <img src="/assets/void-logo.png" alt="" className="relative h-10 w-10 rounded-full object-cover" />
      </div>
      <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        VOID<span className="text-lime">.OS</span>
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.28em] text-lime">
        {loadingText}
      </p>
      <div className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-lime transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
