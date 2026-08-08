import { useEffect, useRef, useState } from 'react'
import { mindGoogleLogin } from '../lib/mindClient'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/**
 * Full Google account — sign-in / register in one click via Identity Services.
 */
export function GoogleSignIn({ onDone, compact = false }) {
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
      })
      slot.current.innerHTML = ''
      window.google.accounts.id.renderButton(slot.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: compact ? 240 : 280,
        logo_alignment: 'left',
      })
      // One Tap prompt (non-blocking)
      try {
        window.google.accounts.id.prompt()
      } catch {
        /* ignore */
      }
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
  }, [onDone, compact])

  if (!CLIENT_ID) {
    return (
      <p className="text-[10px] leading-snug text-muted">
        Google login: set <code className="text-lime/80">VITE_GOOGLE_CLIENT_ID</code> +{' '}
        <code className="text-lime/80">GOOGLE_CLIENT_ID</code> in Vercel env, then redeploy.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
        full account · google
      </p>
      <div ref={slot} className="flex min-h-[44px] items-center justify-center" />
      {busy && <p className="text-[10px] text-lime">signing in…</p>}
      {!ready && !busy && <p className="text-[10px] text-muted">loading google…</p>}
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <p className="text-[10px] leading-relaxed text-muted">
        one Google click = register + login. lots, wallet, and mind memory stay on this account.
      </p>
    </div>
  )
}
