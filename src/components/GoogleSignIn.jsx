import { useEffect, useRef, useState } from 'react'
import { mindGoogleLogin } from '../lib/mindClient'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/**
 * Google Identity Services button → /api/auth-google
 */
export function GoogleSignIn({ onDone }) {
  const slot = useRef(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID || !slot.current) return
    let cancelled = false

    function renderBtn() {
      if (cancelled || !window.google?.accounts?.id || !slot.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          setErr('')
          try {
            const data = await mindGoogleLogin(response.credential)
            onDone?.(data)
          } catch (e) {
            setErr(e.message || 'google failed')
          }
        },
        auto_select: false,
        ux_mode: 'popup',
      })
      slot.current.innerHTML = ''
      window.google.accounts.id.renderButton(slot.current, {
        theme: 'filled_black',
        size: 'medium',
        shape: 'pill',
        text: 'continue_with',
        width: 220,
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
      <p className="text-[10px] leading-snug text-muted">
        Google login: set <code className="text-lime/80">VITE_GOOGLE_CLIENT_ID</code> +{' '}
        <code className="text-lime/80">GOOGLE_CLIENT_ID</code> in env.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <div ref={slot} className="flex min-h-[40px] items-center justify-center" />
      {!ready && <p className="text-[10px] text-muted">loading google…</p>}
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  )
}
