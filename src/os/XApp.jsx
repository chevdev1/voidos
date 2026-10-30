import { useState } from 'react'

// X (Twitter) sign-in with OAuth 2.0 + PKCE. The browser never sees a password and never holds a client secret.
// Needs VITE_X_CLIENT_ID from your X developer app and a callback route on the server (see docs/VOID-OS-GAPS.md).
const CLIENT_ID = import.meta.env.VITE_X_CLIENT_ID || ''
const SCOPES = 'tweet.read users.read offline.access'
const STATE_KEY = 'void-os-x-pkce'

function b64url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function makePkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: b64url(new Uint8Array(digest)) }
}

export function XApp() {
  const [status, setStatus] = useState('idle') // idle | redirecting | error
  const [error, setError] = useState('')
  const configured = Boolean(CLIENT_ID)

  async function signIn() {
    setError('')
    if (!configured) return
    setStatus('redirecting')
    try {
      const { verifier, challenge } = await makePkce()
      const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ verifier, state }))
      const url = new URL('https://x.com/i/oauth2/authorize')
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: `${window.location.origin}/os/x-callback`,
        scope: SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString()
      window.open(url.href, '_blank', 'noopener,noreferrer')
      setStatus('idle')
    } catch (e) {
      setError(e?.message || 'Could not start sign-in.')
      setStatus('error')
    }
  }

  return (
    <div className="os-pad os-stack os-x">
      <div className="os-row os-between">
        <div className="os-x-mark" aria-hidden="true">𝕏</div>
        <span className={`os-tag ${configured ? 'os-tag-ok' : 'os-tag-warn'}`}>
          {configured ? 'ready' : 'not configured'}
        </span>
      </div>

      <div className="os-card os-stack">
        <span className="os-label">Account</span>
        <p className="os-muted os-small">
          Sign in on X itself. VOID.OS receives a limited access token and never sees your password.
        </p>
        <button className="os-btn os-btn-primary" onClick={signIn} disabled={!configured || status === 'redirecting'}>
          {status === 'redirecting' ? 'Opening X…' : 'Sign in with X ↗'}
        </button>
        {!configured && (
          <p className="os-note">
            Sign-in is off until a developer app is connected. Until then you can still open X in a real tab:
          </p>
        )}
        <a className="os-btn" href="https://x.com/i/flow/login" target="_blank" rel="noopener noreferrer">
          Open X in a new tab ↗
        </a>
        {error && <p className="os-error">{error}</p>}
      </div>

      <div className="os-card os-stack">
        <span className="os-label">Timeline</span>
        <p className="os-muted os-small">
          After you sign in, the latest posts from accounts you follow show up here. Nothing is shown before that, so there is no fake feed.
        </p>
      </div>

      <p className="os-note">Tokens stay on the server side of the flow. This window only starts the redirect.</p>
    </div>
  )
}
