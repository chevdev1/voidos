import { useEffect, useRef, useState } from 'react'
import { mindGoogleLogin } from '../lib/mindClient'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/**
 * Google-only auth — custom VOID.OS chrome over GIS button.
 */
export function GoogleSignIn({ onDone }) {
  const slot = useRef(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID || !slot.current) return
    let cancelled = false

    async function handleCredential(response) {
      setErr('')
      setBusy(true)
      try {
        const data = await mindGoogleLogin(response.credential)
        onDone?.(data)
      } catch (e) {
        setErr(e.message || 'google failed')
      } finally {
        setBusy(false)
      }
    }

    function renderBtn() {
      if (cancelled || !window.google?.accounts?.id || !slot.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        ux_mode: 'popup',
        context: 'signin',
        itp_support: true,
        cancel_on_tap_outside: true,
      })
      slot.current.innerHTML = ''
      window.google.accounts.id.renderButton(slot.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: 288,
        logo_alignment: 'left',
      })
      setReady(true)
    }

    if (window.google?.accounts?.id) {
      renderBtn()
      return () => {
        cancelled = true
      }
    }

    const existing = document.querySelector('script[data-gis]')
    if (existing) {
      existing.addEventListener('load', renderBtn)
      return () => {
        cancelled = true
        existing.removeEventListener('load', renderBtn)
      }
    }

    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.dataset.gis = '1'
    s.onload = renderBtn
    document.head.appendChild(s)
    return () => {
      cancelled = true
    }
  }, [onDone])

  if (!CLIENT_ID) {
    return (
      <p className="text-[11px] leading-relaxed text-muted">
        Google Client ID missing in env.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden border border-lime/45 bg-black">
        {/* VOID face */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-between px-3"
          aria-hidden
        >
          <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-lime">
            <span className="inline-flex h-5 w-5 items-center justify-center border border-lime/60 text-[10px]">
              G
            </span>
            {busy ? 'SIGNING IN…' : 'CONTINUE WITH GOOGLE'}
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted">enter</span>
        </div>

        {/* Real GIS control — invisible but clickable on top */}
        <div
          ref={slot}
          className="relative z-10 flex h-11 w-full items-center justify-center opacity-0"
          style={{ minHeight: 44 }}
        />

        {!ready && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/80 text-[10px] tracking-wider text-muted">
            loading…
          </div>
        )}
      </div>

      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  )
}
